import asyncHandler from 'express-async-handler';
import { generateChatReply, GeminiUnavailableError } from '../services/geminiChatService.js';
import apiResponse from '../utils/apiResponse.js';

// @desc    Chat with the AI farming assistant
// @route   POST /api/ai/chat
// @access  Private
const MAX_MESSAGE_LENGTH = 2000; // one message cap (chars)
const MAX_HISTORY_TURNS = 12; // conversation turns sent as context

const sendChat = asyncHandler(async (req, res) => {
  const { message, history } = req.body || {};

  if (typeof message !== 'string' || !message.trim()) {
    res.status(400);
    throw new Error('Please type a question before sending');
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
    res.status(400);
    throw new Error(`Message is too long. Maximum is ${MAX_MESSAGE_LENGTH} characters.`);
  }

  // Configuration problem surfaced honestly — no fake replies.
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!geminiKey || geminiKey.includes('...') || geminiKey.includes('your_')) {
    res.status(503);
    throw new Error(
      'AI chat is not configured on the server. Set GEMINI_API_KEY in the backend .env file.'
    );
  }

  // History must be an array of {role, text} turns; everything else dropped.
  const cleanHistory = Array.isArray(history)
    ? history
        .filter(
          (h) =>
            h &&
            (h.role === 'user' || h.role === 'assistant') &&
            typeof h.text === 'string' &&
            h.text.trim().length > 0
        )
        .slice(-MAX_HISTORY_TURNS)
        .map((h) => ({ role: h.role, text: h.text.trim().slice(0, MAX_MESSAGE_LENGTH) }))
    : [];

  try {
    const reply = await generateChatReply({ message: trimmedMessage, history: cleanHistory });
    apiResponse(res, 200, true, 'AI reply generated', { reply });
  } catch (aiErr) {
    if (aiErr instanceof GeminiUnavailableError) {
      // Temporary provider overload / rate limit / timeout after all retries.
      console.error('[ai/chat] provider temporarily unavailable:', aiErr.message);
      res.status(503);
      throw new Error(
        'AI assistant is temporarily unavailable due to high demand. Please press Retry in a moment.'
      );
    }
    console.error('[ai/chat] configuration error:', aiErr.message);
    res.status(503);
    throw new Error(
      'AI assistant is misconfigured on the server. Check GEMINI_API_KEY / GEMINI_MODEL in the backend .env file.'
    );
  }
});

export { sendChat };
