/**
 * Unit tests for the Gemini chat service (retry / fallback / history handling).
 * No network and no real API key: the SDK call is stubbed via the
 * `callAttempt` test hook of generateChatReply.
 *
 * Usage: node --test server/tests/geminiChatService.test.mjs
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateChatReply,
  normalizeHistory,
  GeminiUnavailableError,
} from '../services/geminiChatService.js';

const fakeSleepCalls = [];
const sleepFn = async (ms) => {
  fakeSleepCalls.push(ms);
};

const callFactory = ({ script, log }) => async (modelName, contents, cfg) => {
  log.models.push(modelName);
  log.timeout = cfg.timeoutMs;
  log.contents = contents;
  const step = script.shift();
  if (step === undefined) return 'AI reply text';
  if (step instanceof Error) throw step;
  return step;
};

const makeHarness = ({ script = [], history = [], message = 'Meri fasal kaise ho?', overrides = {} } = {}) => {
  const log = { models: [], timeout: undefined, contents: undefined };
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
  const promise = generateChatReply({ message, history }, { config, callAttempt, sleepFn });
  return { promise, log };
};

const fetchError = (status, message = `Error fetching [${status}] boom`, details) => {
  const err = new Error(message);
  err.name = 'GoogleGenerativeAIFetchError';
  err.status = status;
  err.errorDetails = details;
  return err;
};

describe('generateChatReply basics', () => {
  test('returns the AI text on the first attempt without sleeping', async () => {
    const { promise, log } = makeHarness({ script: [] });
    const reply = await promise;
    assert.equal(reply, 'AI reply text');
    assert.deepEqual(log.models, ['model-a']);
    assert.equal(fakeSleepCalls.length, 0);
  });

  test('sends the message plus history in order (oldest first)', async () => {
    const history = [
      { role: 'user', text: 'Mitti ki jaanch kaise karun?' },
      { role: 'assistant', text: 'Soil testing ke liye...' },
    ];
    const { promise, log } = makeHarness({ history, message: 'Cost kitna lagega?' });
    await promise;
    assert.deepEqual(log.contents, [
      { role: 'user', parts: [{ text: 'Mitti ki jaanch kaise karun?' }] },
      { role: 'model', parts: [{ text: 'Soil testing ke liye...' }] },
      { role: 'user', parts: [{ text: 'Cost kitna lagega?' }] },
    ]);
  });

  test('per-attempt timeout is passed to the SDK', async () => {
    const { promise, log } = makeHarness({});
    await promise;
    assert.equal(log.timeout, 30000);
  });
});

describe('chat retry / fallback behaviour', () => {
  test('retries a temporary 503 then succeeds on the same model', async () => {
    const { promise, log } = makeHarness({ script: [fetchError(503, 'high demand')] });
    const reply = await promise;
    assert.equal(reply, 'AI reply text');
    assert.deepEqual(log.models, ['model-a', 'model-a']);
    assert.equal(fakeSleepCalls.length, 1);
  });

  test('switches to the fallback model after the retry budget is exhausted', async () => {
    const { promise, log } = makeHarness({
      script: [fetchError(503, 'a1'), fetchError(503, 'a2'), fetchError(503, 'a3')],
    });
    const reply = await promise;
    assert.equal(reply, 'AI reply text');
    assert.deepEqual(log.models, ['model-a', 'model-a', 'model-a', 'model-b']);
  });

  test('all temporary failures surface as an honest GeminiUnavailableError', async () => {
    const { promise } = makeHarness({ script: Array(8).fill(fetchError(503, 'high demand')) });
    await assert.rejects(promise, (err) => {
      assert.ok(err instanceof GeminiUnavailableError);
      assert.match(err.message, /temporarily unavailable/i);
      return true;
    });
  });

  test('auth errors on the primary are never retried or masked', async () => {
    const { promise, log } = makeHarness({ script: [fetchError(401, 'API key not valid')] });
    await assert.rejects(promise, (err) => err.status === 401);
    assert.deepEqual(log.models, ['model-a']);
    assert.equal(fakeSleepCalls.length, 0);
  });

  test('an empty provider response is treated as retryable, never faked', async () => {
    const { promise, log } = makeHarness({ script: ['   '] });
    const reply = await promise;
    assert.equal(reply, 'AI reply text');
    assert.deepEqual(log.models, ['model-a', 'model-a'], 'empty reply retried on the same model');
  });

  test('honours a huge Retry-After by moving to the fallback quickly, not hanging', async () => {
    const err = fetchError(429, '429 too fast', [
      { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '600s' },
    ]);
    const { promise, log } = makeHarness({ script: [err] });
    await promise;
    assert.deepEqual(log.models, ['model-a', 'model-b']);
    assert.equal(fakeSleepCalls.length, 0);
  });
});

describe('normalizeHistory', () => {
  test('drops invalid turns and caps length and size', () => {
    const long = 'x'.repeat(3000);
    const clean = normalizeHistory(
      [
        null,
        { role: 'system', text: 'junk' },
        { role: 'user', text: '  ' },
        { role: 'user', text: 'hello' },
        { role: 'assistant', text: long },
      ],
      12
    );
    assert.deepEqual(clean, [
      { role: 'user', text: 'hello' },
      { role: 'assistant', text: long.slice(0, 2000) },
    ]);
  });

  test('keeps only the newest maxTurns entries', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ role: 'user', text: `m${i}` }));
    const clean = normalizeHistory(many, 4);
    assert.equal(clean.length, 4);
    assert.deepEqual(clean.map((h) => h.text), ['m16', 'm17', 'm18', 'm19']);
  });

  test('non-array input yields an empty history', () => {
    assert.deepEqual(normalizeHistory(undefined), []);
    assert.deepEqual(normalizeHistory('nope'), []);
  });
});
