/**
 * Gemini crop-disease analysis with:
 *  - configurable primary model        (GEMINI_MODEL)
 *  - configurable fallback model(s)    (GEMINI_FALLBACK_MODEL, comma separated)
 *  - limited retries with exponential backoff for temporary errors (429 / 503,
 *    configurable via GEMINI_RETRYABLE_STATUSES), honouring Google's RetryInfo
 *    retryDelay (the same instruction the HTTP Retry-After header carries)
 *  - a per-attempt request timeout       (GEMINI_TIMEOUT_MS)
 *  - single-flight dedup: identical concurrent requests share one retry chain
 *    instead of firing duplicate overlapping retries
 *  - honest failures: authentication / invalid-request / retirable-quota model
 *    errors are never retried away, and no diagnosis is ever fabricated.
 */
import crypto from 'node:crypto';
import genAI from '../config/gemini.js';

const SYSTEM_PROMPT = `You are an expert agricultural plant pathologist AI assistant for Indian farmers.
When given a crop image, analyze it and respond with ONLY valid JSON (no markdown, no code fences, no extra text).

The JSON structure MUST be exactly:
{
  "cropName": { "en": "string", "hi": "string" },
  "disease": { "en": "string", "hi": "string" },
  "confidence": number_between_0_and_1,
  "symptoms": { "en": ["string"], "hi": ["string"] },
  "treatment": { "en": ["string"], "hi": ["string"] },
  "prevention": { "en": ["string"], "hi": ["string"] },
  "medicineKeywords": ["keyword1", "keyword2"],
  "isHealthy": boolean
}

Rules:
- Prefer organic/bio treatments (neem oil, trichoderma, copper, bio-fungicide) first
- medicineKeywords must be lowercase English words matching product names/tags in an agri store
- Hindi text must be simple farmer-friendly Devanagari script
- If you cannot identify the crop or disease with confidence >= 0.6, set confidence below 0.6
- If the crop appears healthy, set isHealthy: true and disease.en to "Healthy Crop"
- Always provide at least 2 symptoms, 3 treatment steps, and 2 prevention tips`;

/**
 * Thrown only when the AI service is temporarily unavailable (overloaded /
 * rate limited / transient network) after `maxRetries` on every model in the
 * chain. The controller maps this to an honest "try again later" message —
 * never a fabricated diagnosis.
 */
class GeminiUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeminiUnavailableError';
    this.isTemporary = true;
  }
}

// ---------------------------------------------------------------- config --
// Defaults verified live against the Gemini API on 2026-10-27 (image input +
// responseMimeType: application/json both accepted):
//   gemini-3.8-flash  — exists but was returning 503 "high demand"
//   gemini-3.5-flash, gemini-3.1-flash-lite, gemini-3.5-flash-lite — OK
//   gemini-2.5-flash  — 404 "no longer available to new users" (do NOT use)
const DEFAULT_MODEL = 'gemini-3.5-flash';
const DEFAULT_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const DEFAULT_RETRYABLE_STATUSES = [429, 503]; // temporary: rate limit / overloaded
// Statuses that mean a config problem — retried, never masked by fallback
const PERMANENT_STATUSES = new Set([400, 401, 403, 404]);
const PERMANENT_MESSAGE_PATTERNS =
  /api[\s_-]?key|permission denied|unregistered caller|invalid argument|no longer available|not allowed/i;

const positiveNumberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/**
 * Resolve runtime configuration. Read on every call (not module load) so that
 * tests can set env vars freely and no stale snapshot is kept.
 * @param {object} [overrides] - test-only per-call overrides
 * @returns {object} config
 */
export const buildConfig = (overrides = {}) => {
  const primaryModel = (process.env.GEMINI_MODEL || '').trim() || DEFAULT_MODEL;
  // Comma separated list; anything that duplicates the primary is dropped.
  const fallbackModels = (process.env.GEMINI_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
    .filter((m) => m !== primaryModel);

  const retryable = (process.env.GEMINI_RETRYABLE_STATUSES ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  return {
    primaryModel,
    fallbackModels,
    // GEMINI_MAX_RETRIES = retries AFTER the first failed attempt (per model)
    maxRetries: Math.min(positiveNumberEnv('GEMINI_MAX_RETRIES', 2), 5),
    baseDelayMs: positiveNumberEnv('GEMINI_RETRY_BASE_MS', 1000),
    // Upper bound on any single wait (including Retry-After), so a huge
    // Retry-After can never hang the HTTP request for minutes.
    maxDelayMs: positiveNumberEnv('GEMINI_RETRY_MAX_DELAY_MS', 10000),
    timeoutMs: positiveNumberEnv('GEMINI_TIMEOUT_MS', 30000),
    retryableStatuses: new Set(retryable.length > 0 ? retryable : DEFAULT_RETRYABLE_STATUSES),
    ...overrides,
  };
};

// -------------------------------------------------------- error handling --
/**
 * Parse Google's structured retry instruction out of the error body. The SDK
 * does not expose HTTP response headers, but it does expose `errorDetails`,
 * which for 429/503 carries `google.rpc.RetryInfo.retryDelay` — the same
 * value the API would send as Retry-After.
 * @param {Error} err
 * @returns {number|null} delay in milliseconds, or null when absent
 */
const parseRetryAfterMs = (err) => {
  const details = err?.errorDetails;
  if (!Array.isArray(details)) return null;
  for (const detail of details) {
    const type = typeof detail?.['@type'] === 'string' ? detail['@type'] : '';
    if (type.includes('RetryInfo')) {
      const raw = String(detail.retryDelay ?? detail.retryAfter ?? '').trim();
      const match = raw.match(/^([0-9]+(?:\.[0-9]+)?)(ms|s|m)$/i);
      if (match) {
        const value = Number(match[1]);
        const unit = match[2].toLowerCase();
        if (unit === 'ms') return value;
        if (unit === 's') return value * 1000;
        if (unit === 'm') return value * 60000;
      }
    }
  }
  return null;
};

/**
 * Classify an attempt error so the retry loop knows what to do with it.
 * Authentication, invalid request, wrong model name and permanent quota
 * errors are NEVER retryable (and must not be masked by model switching).
 * @param {Error} err
 * @param {object} cfg
 * @returns {{ retryable: boolean, status: number|null, retryAfterMs: number|null }}
 */
export const classifyError = (err, cfg) => {
  const name = err?.name || '';
  const status = Number.isFinite(err?.status) ? err.status : null;
  const message = String(err?.message || '');

  // SDK request timeout / aborted fetch — temporary transport failure
  if (
    name === 'GoogleGenerativeAIAbortError' ||
    name === 'AbortError' ||
    /aborted|timed\s?out/i.test(message)
  ) {
    return { retryable: true, status, retryAfterMs: null };
  }

  // Auth / invalid request / a model that does not exist for this key
  if (status !== null && PERMANENT_STATUSES.has(status)) {
    return { retryable: false, status, retryAfterMs: null };
  }
  if (PERMANENT_MESSAGE_PATTERNS.test(message)) {
    return { retryable: false, status, retryAfterMs: null };
  }

  // Explicitly temporary statuses (429 "try later", 503 high demand)
  if (status !== null && cfg.retryableStatuses.has(status)) {
    return { retryable: true, status, retryAfterMs: parseRetryAfterMs(err) };
  }

  // Any other transport-level failure (e.g. fetch network error): temporary
  return { retryable: true, status, retryAfterMs: parseRetryAfterMs(err) };
};

/**
 * How long to wait before the next attempt.
 * - If Google supplied Retry-After / RetryInfo.retryDelay: wait EXACTLY that
 *   long (never shorter — that is what "respecting Retry-After" means).
 * - Otherwise exponential backoff with slight jitter.
 * Returns null when waiting longer than maxDelayMs would be required — in
 * that case the retry chain stops instead of hanging the HTTP request.
 */
const computeWaitMs = (info, attempt, cfg) => {
  let raw;
  if (info.retryAfterMs !== null) {
    raw = info.retryAfterMs; // honour the API's instruction, no jitter-down
  } else {
    const exponential = cfg.baseDelayMs * Math.pow(2, attempt);
    // 0.8–1.0x jitter so parallel failures do not sync into a thundering herd
    raw = Math.round(exponential * (0.8 + Math.random() * 0.2));
  }
  if (raw > cfg.maxDelayMs) return null; // give up rather than wait minutes
  return Math.min(raw, cfg.maxDelayMs);
};

// ------------------------------------------------------------ internals --
/**
 * Gemini-3-class models can return separate "thought" parts the old SDK's
 * `response.text()` would concatenate into the answer text, corrupting the
 * JSON extraction. Prefer explicit answer parts, fall back to text().
 */
const extractResponseText = (response) => {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const answerParts = parts.filter(
      (part) => typeof part.text === 'string' && part.text.length > 0 && part.thought !== true
    );
    if (answerParts.length > 0) {
      return answerParts.map((part) => part.text).join('');
    }
  }
  return response.text();
};

const normalizeMimeType = (mimeType) =>
  mimeType === 'image/jpg' ? 'image/jpeg' : mimeType || 'image/jpeg';

const buildContents = (imageBuffer, mimeType) => {
  const mediaType = normalizeMimeType(mimeType);
  return [
    'Analyze this crop image and return the JSON as specified. Focus on identifying any diseases or health issues.',
    {
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mediaType,
      },
    },
  ];
};

/**
 * One Gemini API attempt using the installed @google/generative-ai SDK.
 * Kept as a separate injectable function so tests can stub it.
 */
const callAttempt = async (modelName, contents, cfg) => {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
    // The SDK aborts the underlying fetch after cfg.timeoutMs, which we then
    // classify as a retryable transport failure (bounded request latency).
    requestOptions: { timeout: cfg.timeoutMs },
  });

  const result = await model.generateContent(contents);
  const response = await result.response;
  return extractResponseText(response);
};

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sequential run over the model chain: primary first (GEMINI_MODEL), then the
 * fallback model(s). Retries within a model are strictly awaited one after
 * another — a retry starts only when the previous attempt has fully ANDed,
 * so overlapping/duplicate retries inside one request are impossible.
 * Model switching happens ONLY for retryable (temporary) errors.
 */
const runAnalysis = async (contents, cfg, deps) => {
  const modelChain = [cfg.primaryModel, ...cfg.fallbackModels];
  let lastError = null;
  let attemptsMade = 0;
  let fallbackProblem = '';

  for (let pi = 0; pi < modelChain.length; pi++) {
    const modelName = modelChain[pi];
    const isFallback = pi > 0;

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      attemptsMade += 1;
      try {
        const rawText = await deps.callAttempt(modelName, contents, cfg);
        return parseGeminiResponse(rawText);
      } catch (err) {
        lastError = err;
        const info = classifyError(err, cfg);
        console.error(
          `[gemini] ${modelName} attempt ${attempt + 1}/${cfg.maxRetries + 1}` +
            ` failed${info.status ? ` (status=${info.status})` : ''}: ${err?.message || err}`
        );

        if (!info.retryable) {
          // A bad/expired fallback name or key problem on a fallback must not
          // turn a temporarily-overloaded primary into a hard crash: skip it.
          if (isFallback) {
            fallbackProblem = `${modelName}: ${err?.message || err}`;
            console.warn(`[gemini] fallback model unusable — skipping. ${fallbackProblem}`);
            break; // next model in the chain
          }
          // Primary is misconfigured (auth / invalid request): surface honestly.
          throw err;
        }

        if (attempt >= cfg.maxRetries) break; // retries exhausted for this model

        const waitMs = computeWaitMs(info, attempt, cfg);
        if (waitMs === null) {
          console.warn(
            `[gemini] ${modelName}: ${info.retryAfterMs ?? 'unknown'}ms Retry-After exceeds the ` +
              `${cfg.maxDelayMs}ms budget — not retrying sooner.`
          );
          break; // next model in the chain
        }
        await deps.sleep(waitMs);
      }
    }
  }

  if (attemptsMade > 0 && fallbackProblem) {
    console.warn(`[gemini] one or more fallback models were unusable by this API key. ${fallbackProblem}`);
  }
  throw new GeminiUnavailableError(
    `AI analysis is temporarily unavailable after ${attemptsMade} attempt(s) across` +
      ` models (${modelChain.join(' -> ')}). Last error: ${lastError?.message || lastError}`
  );
};

/**
 * Single-flight guard: identical in-flight analyses share one promise.
 * A duplicate concurrent request (e.g. a client re-submitting the same image)
 * therefore cannot start its own overlapping retry chain.
 */
const analysesInFlight = new Map();

// ------------------------------------------------------------- public API --
/**
 * Analyze a crop image using Google Gemini vision.
 * @param {Buffer} imageBuffer - Image buffer
 * @param {string} mimeType - Image MIME type (e.g. image/jpeg, image/png)
 * @param {object} [opts] - test hookups:
 *   { config: overrides, genAI, callAttempt(modelName, contents, cfg), sleepFn(ms) }
 * @returns {Promise<object>} { success, data?, error? } — same shape as before
 * @throws {GeminiUnavailableError} when the service is temporarily unavailable
 */
const analyzeCropImage = async (imageBuffer, mimeType, opts = {}) => {
  const cfg = buildConfig(opts.config);
  const deps = {
    genAI: opts.genAI || genAI,
    callAttempt: opts.callAttempt || callAttempt,
    sleep: opts.sleepFn || defaultSleep,
  };
  const contents = buildContents(imageBuffer, mimeType);

  const dedupKey =
    modelChainKey(cfg) + ':' + normalizeMimeType(mimeType) + ':' +
    crypto.createHash('sha256').update(imageBuffer).digest('hex');

  const existing = analysesInFlight.get(dedupKey);
  if (existing) return existing;

  const promise = runAnalysis(contents, cfg, deps).finally(() => {
    analysesInFlight.delete(dedupKey);
  });
  analysesInFlight.set(dedupKey, promise);
  return promise;
};

const modelChainKey = (cfg) => [cfg.primaryModel, ...cfg.fallbackModels].join(',');

/**
 * Safely parse Gemini's JSON response (unchanged behaviour)
 * @param {string} rawText - Raw text from Gemini
 * @returns {object} Parsed result or failure object
 */
const parseGeminiResponse = (rawText) => {
  try {
    // Strip code fences if present
    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    cleaned = cleaned.trim();

    // Find JSON object boundaries
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) {
      throw new Error('No JSON object found in response');
    }
    cleaned = cleaned.substring(startIdx, endIdx + 1);

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (
      !parsed.cropName ||
      !parsed.disease ||
      typeof parsed.confidence !== 'number' ||
      !parsed.symptoms ||
      !parsed.treatment
    ) {
      throw new Error('Missing required fields in Gemini response');
    }

    // Ensure arrays exist
    parsed.symptoms = parsed.symptoms || { en: [], hi: [] };
    parsed.treatment = parsed.treatment || { en: [], hi: [] };
    parsed.prevention = parsed.prevention || { en: [], hi: [] };
    parsed.medicineKeywords = parsed.medicineKeywords || [];

    return { success: true, data: parsed };
  } catch (error) {
    console.error('Gemini response parse error:', error.message);
    return { success: false, error: error.message };
  }
};

export { analyzeCropImage, parseGeminiResponse, GeminiUnavailableError };
