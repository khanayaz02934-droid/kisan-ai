/**
 * Unit tests for the Gemini retry / fallback / failure handling.
 * No network and no real API key: the SDK call is stubbed via the
 * `callAttempt` test hook of analyzeCropImage.
 *
 * Usage: node --test server/tests/geminiService.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeCropImage,
  parseGeminiResponse,
  classifyError,
  buildConfig,
  GeminiUnavailableError,
} from '../services/geminiService.js';

// Minimal valid 1x1 transparent PNG (same as the integration suite uses)
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const VALID_JSON =
  '{"cropName":{"en":"Tomato","hi":"टमाटर"},"disease":{"en":"Early Blight","hi":"शुरुआती झुलसा"},' +
  '"confidence":0.9,"symptoms":{"en":["spots"],"hi":["धब्बे"]},"treatment":{"en":["neem"],"hi":["नीम"]},' +
  '"prevention":{"en":["water early"],"hi":["सुबह पानी"]},"medicineKeywords":["neem"],"isHealthy":false}';

const fakeSleepCalls = [];
const sleepFn = async (ms) => {
  fakeSleepCalls.push(ms);
};

const callFactory = ({ script, log }) => async (modelName, contents, cfg) => {
  log.models.push(modelName);
  log.timeout = cfg.timeoutMs;
  const [promptText, imagePart] = contents;
  log.mime = imagePart.inlineData.mimeType;
  const step = script.shift();
  if (step === undefined) return VALID_JSON; // default: succeed
  if (step instanceof Error) throw step;
  if (step === 'VALID') return typeof step === 'string' ? VALID_JSON : step;
  if (step === 'INVALID') return 'not json at all';
  return step;
};

const makeHarness = (script, overrides = {}) => {
  const log = { models: [], mime: undefined, timeout: undefined };
  fakeSleepCalls.length = 0;
  const config = {
    primaryModel: 'model-a',
    fallbackModels: ['model-b'],
    maxRetries: 2,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    timeoutMs: 30000,
    retryableStatuses: new Set([429, 503]),
    ...overrides,
  };
  const callAttempt = callFactory({ script, log });
  const promise = analyzeCropImage(tinyPng, 'image/png', { config, callAttempt, sleepFn });
  return { promise, log };
};

const fetchError = (status, message = `Error fetching from https://generativelanguage.googleapis.com/... [${status}] boom`, details) => {
  const err = new Error(message);
  err.name = 'GoogleGenerativeAIFetchError';
  err.status = status;
  err.errorDetails = details;
  return err;
};

describe('parseGeminiResponse', () => {
  test('parses a valid list', () => {
    const { success, data } = parseGeminiResponse(VALID_JSON);
    assert.equal(success, true);
    assert.equal(data.cropName.en, 'Tomato');
  });

  test('parses code-fenced JSON', () => {
    const { success, data } = parseGeminiResponse('```json\n' + VALID_JSON + '\n```');
    assert.equal(success, true);
    assert.equal(data.disease.hi, 'शुरुआती झुलसा');
  });

  test('returns failure (no throw, no diagnosis) for garbage', () => {
    const { success, error } = parseGeminiResponse('I could not analyze this');
    assert.equal(success, false);
    assert.ok(error);
  });
});

describe('classifyError', () => {
  const cfg = buildConfig({});

  test('503 and 429 are retryable', () => {
    assert.equal(classifyError(fetchError(503), cfg).retryable, true);
    assert.equal(classifyError(fetchError(429), cfg).retryable, true);
  });

  test('400/401/403/404 (auth, invalid request, unknown model) are permanent', () => {
    for (const status of [400, 401, 403, 404]) {
      const info = classifyError(fetchError(status), cfg);
      assert.equal(info.retryable, false, `status ${status} must be permanent`);
    }
  });

  test('timeout/aborted errors are retryable', () => {
    const abort = new Error('Request aborted when fetching https://x');
    abort.name = 'GoogleGenerativeAIAbortError';
    assert.equal(classifyError(abort, cfg).retryable, true);

    const netErr = new Error('Error fetching from https://x: socket timeout');
    assert.equal(classifyError(netErr, cfg).retryable, true);
  });

  test('quota messages embedded in 429 stay retryable with Retry-After', () => {
    const err = fetchError(429, '429 RESOURCE_EXHAUSTED', [
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '18s' },
    ]);
    const info = classifyError(err, cfg);
    assert.equal(info.retryable, true);
    assert.equal(info.retryAfterMs, 18000);
  });

  test('permits explicit env extension of the retryable status set', () => {
    const custom = buildConfig({ retryableStatuses: new Set([500]) });
    assert.equal(classifyError(fetchError(500), custom).retryable, true);
    assert.equal(classifyError(fetchError(500), cfg).retryable, true); // generic transport fallback
  });
});

describe('retry behaviour', () => {
  test('succeeds on the first attempt without sleeping', async () => {
    const { promise, log } = makeHarness([]);
    const result = await promise;
    assert.equal(result.success, true);
    assert.deepEqual(log.models, ['model-a']);
    assert.equal(fakeSleepCalls.length, 0);
  });

  test('retries a temporary 503 then succeeds on the same model', async () => {
    const { promise, log } = makeHarness([fetchError(503, '[503] high demand')]);
    const result = await promise;
    assert.equal(result.success, true);
    assert.deepEqual(log.models, ['model-a', 'model-a'], 'retry must stay on the primary model');
    assert.equal(fakeSleepCalls.length, 1);
    assert.ok(fakeSleepCalls[0] > 0 && fakeSleepCalls[0] <= 1000);
  });

  test('honours Google RetryInfo retryDelay exactly', async () => {
    const err = fetchError(503, 'high demand', [
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '3s' },
    ]);
    const { promise } = makeHarness([err, err]);
    await promise;
    assert.equal(fakeSleepCalls.length, 2);
    assert.equal(fakeSleepCalls[0], 3000);
    assert.equal(fakeSleepCalls[1], 3000);
  });

  test('gives up (does not butcher the request budget) when Retry-After exceeds maxDelay', async () => {
    const err = fetchError(429, '429 too fast', [
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '600s' },
    ]);
    const { promise, log } = makeHarness([err]);
    const result = await promise; // fallback used instead of waiting 10 minutes
    assert.equal(result.success, true);
    assert.deepEqual(log.models, ['model-a', 'model-b']);
    assert.equal(fakeSleepCalls.length, 0, 'no sleep should have been recorded');
  });

  test('timeout/abort errors are retried', async () => {
    const abort = new Error('Request aborted when fetching https://x');
    abort.name = 'GoogleGenerativeAIAbortError';
    const { promise, log } = makeHarness([abort]);
    const result = await promise;
    assert.equal(result.success, true);
    assert.deepEqual(log.models, ['model-a', 'model-a']);
  });

  test('per-attempt timeout is passed to the SDK', async () => {
    const { promise, log } = makeHarness([]);
    await promise;
    assert.equal(log.timeout, 30000);
  });
});

describe('fallback behaviour', () => {
  test('switches to the fallback model only after retry budget is exhausted', async () => {
    const { promise, log } = makeHarness([
      fetchError(503, 'a1'), fetchError(503, 'a2'), fetchError(503, 'a3'),
    ]);
    const result = await promise;
    assert.equal(result.success, true);
    assert.deepEqual(log.models, ['model-a', 'model-a', 'model-a', 'model-b']);
  });

  test('auth/invalid-request errors on the primary are re-thrown, never retried or masked', async () => {
    const { promise, log } = makeHarness([fetchError(401, 'API key not valid')]);
    await assert.rejects(promise, (err) => err.status === 401);
    assert.deepEqual(log.models, ['model-a']);
    assert.equal(fakeSleepCalls.length, 0, 'no retry on auth errors');
  });

  test('invalid request (400) never retries or falls back', async () => {
    const { promise, log } = makeHarness([fetchError(400, 'INVALID_ARGUMENT')]);
    await assert.rejects(promise, (err) => err.status === 400);
    assert.deepEqual(log.models, ['model-a']);
  });

  test('a fallback unsupported by the key is skipped without masking the primary, then fails honestly', async () => {
    const { promise, log } = makeHarness([
      fetchError(503, 'overloaded primary'),
      fetchError(503, 'overloaded primary'),
      fetchError(503, 'overloaded primary'),
      fetchError(404, 'This model models/model-b is no longer available to new users.'),
    ]);
    await assert.rejects(promise, (err) => {
      assert.ok(err instanceof GeminiUnavailableError);
      assert.ok(err.isTemporary);
      assert.match(err.message, /temporarily unavailable/i);
      return true;
    });
    assert.deepEqual(log.models, ['model-a', 'model-a', 'model-a', 'model-b']);
  });

  test('all temporary failures across the chain return an honest GeminiUnavailableError', async () => {
    const { promise, log } = makeHarness(Array(8).fill(fetchError(503, 'high demand')));
    await assert.rejects(promise, (err) => {
      assert.ok(err instanceof GeminiUnavailableError);
      assert.ok(err.isTemporary);
      assert.match(err.message, /temporarily unavailable/i);
      return true;
    });
    assert.deepEqual(log.models, ['model-a', 'model-a', 'model-a', 'model-b', 'model-b', 'model-b']);
  });

  test('parse failure is passed through unchanged (no fabricated diagnosis, no fallback)', async () => {
    const { promise, log } = makeHarness(['INVALID']);
    const result = await promise;
    assert.equal(result.success, false);
    assert.ok(result.error);
    assert.deepEqual(log.models, ['model-a']);
    assert.equal(fakeSleepCalls.length, 0);
  });
});

describe('request hygiene', () => {
  test('image/jpg is normalized to image/jpeg before upload', async () => {
    const log = { models: [], mime: undefined };
    fakeSleepCalls.length = 0;
    await analyzeCropImage(tinyPng, 'image/jpg', {
      config: buildConfig({}),
      callAttempt: callFactory({ script: [], log }),
      sleepFn,
    });
    assert.equal(log.mime, 'image/jpeg');
  });

  test('duplicate concurrent identical requests share one retry chain', async () => {
    fakeSleepCalls.length = 0;
    const log = { models: [] };
    const callAttempt = async (modelName, contents, cfg) => {
      log.models.push(modelName);
      const err = fetchError(503, 'slow overload');
      await new Promise((r) => setTimeout(r, 20));
      throw err;
    };
    const config = buildConfig({ maxRetries: 1, baseDelayMs: 10, maxDelayMs: 1000 });
    const p1 = analyzeCropImage(tinyPng, 'image/png', { config, callAttempt, sleepFn });
    const p2 = analyzeCropImage(tinyPng, 'image/png', { config, callAttempt, sleepFn });

    await assert.rejects(p1, GeminiUnavailableError);
    await assert.rejects(p2, GeminiUnavailableError);
    // primary(2 attempts) + fallback(2 attempts) — NOT duplicated per caller
    assert.deepEqual(
      log.models,
      ['gemini-3.5-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite'],
      'identical concurrent calls must not fire duplicate overlapping retries'
    );
  });
});
