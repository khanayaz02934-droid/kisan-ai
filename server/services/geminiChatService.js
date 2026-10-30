/**
 * Gemini farming-chat with:
 *  - the SAME retry / fallback / timeout machinery as the crop scanner
 *    (classifyError + buildConfig are reused, not duplicated)
 *  - conversation history passed to the model so follow-up questions work
 *  - honest failures: temporary unavailability surfaces as
 *    GeminiUnavailableError, config problems as a permanent error —
 *    a fake/hardcoded reply is NEVER generated.
 */
import genAI from '../config/gemini.js';
import { buildConfig, classifyError, GeminiUnavailableError } from './geminiService.js';

const SYSTEM_PROMPT = `You are "Kisan AI Sahayak", a friendly farming assistant for Indian farmers on the Kisan AI web app.

Rules:
- Reply in the SAME language the farmer's latest message is written in: Hindi (Devanagari) or English. If the farmer mixes both, reply in the language of most of the message.
- Answer ONLY farming related topics: crops, seeds, diseases and pests, soil, irrigation, fertilizers (prefer organic options), mandi/marketing, government schemes for farmers, farm costs. Politely redirect anything unrelated back to farming.
- Be practical and specific: small paragraphs or short bullet lists a farmer can act on. Mention rough dosages, timings and local-seasonal context for India.
- If a serious disease, pesticide choice or financial decision is involved, advise consulting a certified agriculture expert or the nearest Krishi Vigyan Kendra.
- Never claim to see images. If the farmer asks about a sick plant, describe symptoms textually and suggest using the AI Crop Scanner in the app with a photo.
- Keep markdown simple: plain text, short bullet lists ("- "), numbered steps, and *bold* for key terms. No tables, no code blocks, no links.
- Keep answers under ~350 words unless the farmer asks for detail.`;

const MAX_OUTPUT_TOKENS = 1024;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extract the answer text from the response. Mirrors the crop scanner's
 * extraction: Gemini-3-class models return separate "thought" parts that the
 * old SDK's response.text() would concatenate into the answer.
 */
const extractChatText = (response) => {
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const answerParts = parts.filter(
      (part) => typeof part.text === 'string' && part.text.length > 0 && part.thought !== true
    );
    if (answerParts.length > 0) {
      return answerParts.map((part) => part.text).join('').trim();
    }
  }
  return String(response?.text?.() ?? '').trim();
};

/**
 * One Gemini API attempt for a chat turn. Injectable for unit tests.
 * Multi-turn uses the SDK's documented chat API: startChat({ history }) +
 * sendMessage(), because generateContent() does not accept role-tagged
 * history contents (SDK serializes them wrongly -> 400 "Unknown name role").
 * `contents` layout (same for the real call and the test stub):
 *  [ ...history turns {role:'user'|'model', parts:[{text}]}, {user-new-message} ]
 */
const callChatAttempt = async (modelName, contents, cfg) => {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
    requestOptions: { timeout: cfg.timeoutMs },
  });
  const history = contents.slice(0, -1);
  const newMessage = contents[contents.length - 1]?.parts?.[0]?.text ?? '';
  const chat = model.startChat({ history });
  const result = await chat.sendMessage(newMessage);
  const response = await result.response;
  const text = extractChatText(response);
  if (!text) {
    // An empty answer is treated like a temporary provider failure so the
    // normal retry chain runs and, if it persists, the caller gets an honest
    // error — never a fabricated reply.
    const err = new Error('Empty response from AI provider');
    err.status = 503;
    throw err;
  }
  return text;
};

/**
 * Normalize + sanitize caller-supplied history into Gemini chat parts.
 * Order assumed oldest → newest. Empty/oversized/invalid turns are dropped.
 * @param {Array<{role:string, text:string}>} history
 * @param {number} maxTurns
 * @returns {Array<{role:'user'|'assistant', text:string}>}
 */
export const normalizeHistory = (history, maxTurns = 12) => {
  if (!Array.isArray(history)) return [];
  const clean = history
    .filter(
      (h) =>
        h &&
        (h.role === 'user' || h.role === 'assistant') &&
        typeof h.text === 'string' &&
        h.text.trim().length > 0
    )
    .slice(-maxTurns)
    .map((h) => ({ role: h.role, text: h.text.trim().slice(0, 2000) }));
  return clean;
};

const defaultRetry = async (messageText, history, cfg, deps) => {
  const modelChain = [cfg.primaryModel, ...cfg.fallbackModels];
  const contents = history.map((h) => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }],
  }));
  contents.push({ role: 'user', parts: [{ text: messageText }] });

  let lastError = null;
  let attemptsMade = 0;

  for (let pi = 0; pi < modelChain.length; pi++) {
    const modelName = modelChain[pi];
    const isFallback = pi > 0;

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      attemptsMade += 1;
      try {
        const text = String(await deps.callAttempt(modelName, contents, cfg) ?? '').trim();
        if (!text) {
          // An empty answer is a temporary provider failure: retry normally
          // and, if it persists, surface an honest error — never a fake reply.
          const err = new Error('Empty response from AI provider');
          err.status = 503;
          throw err;
        }
        return text;
      } catch (err) {
        lastError = err;
        const info = classifyError(err, cfg);
        console.error(
          `[gemini-chat] ${modelName} attempt ${attempt + 1}/${cfg.maxRetries + 1}` +
            ` failed${info.status ? ` (status=${info.status})` : ''}: ${err?.message || err}`
        );

        if (!info.retryable) {
          if (isFallback) {
            console.warn(`[gemini-chat] fallback model unusable — skipping: ${err?.message || err}`);
            break; // next model in the chain
          }
          throw err; // primary misconfigured — surface honestly
        }

        if (attempt >= cfg.maxRetries) break;

        // Same wait policy as the crop scanner (Retry-After aware, capped).
        const exponential = cfg.baseDelayMs * Math.pow(2, attempt);
        const raw =
          info.retryAfterMs !== null
            ? info.retryAfterMs
            : Math.round(exponential * (0.8 + Math.random() * 0.2));
        if (raw > cfg.maxDelayMs) break; // next model instead of a long hang
        await deps.sleep(Math.min(raw, cfg.maxDelayMs));
      }
    }
  }

  throw new GeminiUnavailableError(
    `AI chat is temporarily unavailable after ${attemptsMade} attempt(s) across` +
      ` models (${modelChain.join(' -> ')}). Last error: ${lastError?.message || lastError}`
  );
};

/**
 * Generate a chat reply for one farmer question.
 * @param {object} args
 * @param {string} args.message - the farmer's new message (already validated)
 * @param {Array<{role:'user'|'assistant', text:string}>} [args.history]
 * @param {object} [opts] - test hooks: { config, callAttempt(model, contents, cfg), sleepFn }
 * @returns {Promise<string>} the AI answer text
 * @throws {GeminiUnavailableError} when temporarily unavailable everywhere
 * @throws {Error} unchanged for permanent configuration errors (bad key/model)
 */
export const generateChatReply = async ({ message, history = [] }, opts = {}) => {
  const cfg = buildConfig(opts.config);
  const deps = {
    callAttempt: opts.callAttempt || callChatAttempt,
    sleep: opts.sleepFn || defaultSleep,
  };
  const cleanHistory = normalizeHistory(history);
  return defaultRetry(message.trim(), cleanHistory, cfg, deps);
};

export { GeminiUnavailableError };
