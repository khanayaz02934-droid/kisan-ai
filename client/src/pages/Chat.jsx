import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Leaf,
  MessageSquarePlus,
  Send,
  Trash2,
  User,
  RotateCcw,
} from 'lucide-react';
import Button from '../components/ui/Button';
import { aiChatService } from '../services';
import { apiErrorMessage } from '../services/api';
import { cx } from '../utils/helpers';

// ------------------------- safe inline markdown (JSX, never raw HTML) -------
const renderInline = (text) => {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={i} className="font-bold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};

/**
 * Minimal, safe markdown renderer → React elements only.
 * Supports: headings (#, ##, ###), bullet lists (- / * / •), numbered
 * lists and paragraphs. User/AI text is never rendered as HTML, so a
 * malicious message can never inject markup into the DOM.
 */
const renderMarkdown = (text) => {
  const blocks = [];
  let list = null; // { type: 'ul' | 'ol', items: [] }
  const flushList = () => {
    if (list) {
      const Tag = list.type;
      blocks.push(
        <Tag
          key={`l${blocks.length}`}
          className={cx(
            'space-y-1 pl-5 text-sm',
            list.type === 'ul' ? 'list-disc' : 'list-decimal'
          )}
        >
          {list.items.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </Tag>
      );
      list = null;
    }
  };
  const pushPara = (line) => {
    blocks.push(
      <p key={`p${blocks.length}`} className="text-sm leading-relaxed">
        {renderInline(line)}
      </p>
    );
  };

  for (const rawLine of String(text).split('\n')) {
    const line = rawLine.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•])\s+(.*)$/);
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    const heading = line.match(/^\s*(#{1,4})\s+(.*)$/);

    if (heading) {
      flushList();
      blocks.push(
        <p key={`h${blocks.length}`} className="text-sm font-bold">
          {renderInline(heading[2])}
        </p>
      );
    } else if (bullet) {
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', items: [] };
      }
      list.items.push(numbered[2]);
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      pushPara(line);
    }
  }
  flushList();
  return blocks;
};

// ---------------------------------------------------------------------------

let msgId = 0;
const nextId = () => `m${++msgId}`;

const EXAMPLE_KEYS = ['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6'];

export default function Chat() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const textareaRef = useRef(null);
  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Grow the textarea with content (capped by max-height via CSS).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const send = async (rawText, { existingAiId } = {}) => {
    const text = String(rawText || '').trim();
    if (!text || isTyping) return;

    // Snapshot from the current render's state (never inside a setState
    // updater — updater functions must stay pure).
    let next = messages;
    if (existingAiId) {
      // Retry: clear the failed AI bubble in place, no new user bubble.
      next = messages.map((m) =>
        m.id === existingAiId ? { ...m, state: 'sending', text: '' } : m
      );
    } else {
      next = [
        ...messages,
        { id: nextId(), role: 'user', text, state: 'ok' },
        { id: nextId(), role: 'ai', text: '', state: 'sending', failed: false },
      ];
    }
    // History = every settled turn BEFORE the message being answered.
    const aiMsg = next[next.length - 1];
    const aiIndex = next.findIndex((m) => m.id === aiMsg.id);
    const history = next
      .slice(0, aiIndex)
      .filter((m) => m.state === 'ok' && m.text)
      .map((m) => ({ role: m.role === 'ai' ? 'assistant' : 'user', text: m.text }));
    const aiId = aiMsg.id;

    setMessages(next);
    setIsTyping(true);
    setInput('');
    try {
      const data = await aiChatService.send(text, history);
      const reply = data?.reply;
      if (!reply || !String(reply).trim()) throw new Error('Empty reply from AI');
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId ? { ...m, state: 'ok', text: String(reply), failed: false } : m
        )
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId
            ? { ...m, state: 'error', text: apiErrorMessage(err), failed: true }
            : m
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  const retryFailed = () => {
    if (isTyping) return;
    const failedIdx = [...messages].reverse().findIndex((m) => m.failed);
    if (failedIdx === -1) return;
    const idx = messages.length - 1 - failedIdx;
    const userText = messages[idx - 1]?.role === 'user' ? messages[idx - 1].text : null;
    if (userText) send(userText, { existingAiId: messages[idx].id });
  };

  const clearConversation = ({ confirmFirst = false } = {}) => {
    if (confirmFirst && messages.length > 0 && !window.confirm(t('chat.clearConfirm'))) return;
    if (isTyping) return;
    setMessages([]);
    setInput('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Enter sends; Shift+Enter inserts a newline
      send(input);
    }
  };

  const hasMessages = messages.length > 0;
  const lastFailed = hasMessages && messages[messages.length - 1]?.failed;

  return (
    <div className="mx-auto flex h-[calc(100dvh-11.5rem)] min-h-[480px] max-w-3xl flex-col md:h-[calc(100dvh-8.5rem)]">
      {/* Header: title + conversation actions */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{t('chat.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('chat.subtitle')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            className="!px-3"
            onClick={() => clearConversation()}
            disabled={!hasMessages || isTyping}
            title={t('chat.newChat')}
          >
            <MessageSquarePlus size={18} />
            <span className="hidden sm:inline">{t('chat.newChat')}</span>
          </Button>
          <Button
            variant="outline"
            className="!px-3"
            onClick={() => clearConversation({ confirmFirst: true })}
            disabled={!hasMessages || isTyping}
            title={t('chat.clearChat')}
          >
            <Trash2 size={18} />
            <span className="hidden sm:inline">{t('chat.clearChat')}</span>
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-gray-50 p-3 sm:p-4"
        style={{ maxHeight: '100%' }}
      >
        {!hasMessages && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-light text-primary">
              <Bot size={30} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-ink">{t('chat.welcomeTitle')}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">{t('chat.welcomeDesc')}</p>
            </div>
            <div className="w-full max-w-md">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                {t('chat.examplesTitle')}
              </p>
              <div className="flex flex-col gap-2">
                {EXAMPLE_KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => send(t(`chat.${key}`))}
                    className="btn-touch rounded-xl border border-line bg-white px-4 py-2.5 text-left text-sm font-medium text-ink transition hover:border-primary hover:text-primary-hover"
                  >
                    {t(`chat.${key}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={cx('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {m.role === 'ai' && (
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                <Leaf size={16} />
              </span>
            )}
            <div
              className={cx(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[75%]',
                m.role === 'user'
                  ? 'rounded-br-md bg-primary text-white'
                  : m.state === 'error'
                    ? 'rounded-bl-md border border-red-200 bg-red-50'
                    : 'rounded-bl-md border border-line bg-white'
              )}
            >
              {m.role === 'user' ? (
                <p className="whitespace-pre-wrap break-words text-sm">{m.text}</p>
              ) : m.state === 'sending' ? (
                <div className="flex items-center gap-2 px-1 py-1" aria-live="polite">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                  </span>
                  <span className="text-xs text-muted">{t('chat.thinking')}</span>
                </div>
              ) : m.state === 'error' ? (
                <div>
                  <p className="text-sm font-semibold text-red-700">{t('chat.failed')}</p>
                  <p className="mt-1 break-words text-xs text-red-600">{m.text}</p>
                  <Button variant="danger" className="mt-2 !py-2 !text-xs" onClick={retryFailed}>
                    <RotateCcw size={14} /> {t('chat.retry')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 text-ink">{renderMarkdown(m.text)}</div>
              )}
            </div>
            {m.role === 'user' && (
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600">
                <User size={16} />
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="mt-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('chat.inputPlaceholder')}
            rows={1}
            className="max-h-[140px] min-h-[48px] flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-primary"
          />
          <Button
            onClick={() => send(input)}
            disabled={isTyping || !input.trim()}
            className="!min-h-[48px] !px-4"
            aria-label={t('chat.send')}
          >
            <Send size={18} />
          </Button>
        </div>
        {lastFailed && (
          <p className="mt-2 text-xs text-red-600">
            {t('chat.failed')} —{' '}
            <button
              onClick={retryFailed}
              className="font-bold underline"
              disabled={isTyping}
            >
              {t('chat.retry')}
            </button>
          </p>
        )}
        <p className="mt-2 text-center text-xs text-muted">⚠️ {t('chat.disclaimer')}</p>
      </div>
    </div>
  );
}
