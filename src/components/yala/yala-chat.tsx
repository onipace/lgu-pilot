'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getOrCreateSessionId } from '@/components/pillar/participant-id';

interface YalaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  responseTimeMs?: number;
}

function formatTimestamp(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const WELCOME_MESSAGE: YalaMessage = {
  id: 'yala-welcome',
  role: 'assistant',
  content:
    'Magandang araw! Ako si Y.A.L.A., ang iyong AI Legislative Assistant para sa Municipality of Pitogo. Paano kita matutulungan ngayon?\n\nHello! I can help you with questions about Pitogo LGU services, ordinances, permits, and local governance.',
  timestamp: new Date(),
};

function generateId(): string {
  return `yala-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

interface YalaChatProps {
  onSendPrompt?: (fn: (text: string) => void) => void;
  participantName?: string | null;
}

export default function YalaChat({ onSendPrompt, participantName }: YalaChatProps) {
  const [messages, setMessages] = useState<YalaMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Elapsed timer while loading
  useEffect(() => {
    if (!isLoading) { setElapsedSec(0); return; }
    setElapsedSec(0);
    const interval = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: YalaMessage = { id: generateId(), role: 'user', content: trimmed, timestamp: new Date() };
    const assistantId = generateId();

    // Only add user message — assistant message appears when content arrives
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const startTime = Date.now();

    const doFetch = async (): Promise<string> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      try {
        const history = messages
          .filter(m => m.id !== 'yala-welcome')
          .map(m => ({ role: m.role, content: m.content }));

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module: 'yala',
            message: trimmed,
            history,
            participantName: participantName || undefined,
            sessionId: getOrCreateSessionId(),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = new Error(`API error: ${response.status}`) as Error & { status?: number };
          err.status = response.status;
          throw err;
        }

        let fullContent = '';
        let messageCreated = false;
        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split('\n')) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('data: ') && !trimmedLine.includes('[DONE]')) {
                try {
                  const parsed = JSON.parse(trimmedLine.slice(6));
                  fullContent += parsed.text;
                  if (!messageCreated) {
                    const msg: YalaMessage = { id: assistantId, role: 'assistant', content: fullContent, timestamp: new Date() };
                    setMessages(prev => [...prev, msg]);
                    messageCreated = true;
                  } else {
                    setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
                  }
                } catch { /* skip */ }
              }
            }
          }
        }

        if (!messageCreated) {
          const msg: YalaMessage = { id: assistantId, role: 'assistant', content: fullContent || 'Walang natanggap na sagot.', timestamp: new Date() };
          setMessages(prev => [...prev, msg]);
        }

        return fullContent;
      } finally {
        clearTimeout(timeout);
      }
    };

    const isRetryable = (err: unknown): boolean => {
      if (err instanceof Error && err.name === 'AbortError') return false;
      const status = (err as { status?: number })?.status;
      return !status || status === 429 || status === 502 || status === 503 || status === 504;
    };

    const getErrorMessage = (err: unknown): string => {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'Pasensya na, nag-timeout ang request. Maaaring maraming gumagamit ngayon — pakisubukan muli sa ilang sandali.';
      }
      const status = (err as { status?: number })?.status;
      if (status === 429) return 'Masyadong maraming request ngayon. Maghintay lang po ng ilang segundo at subukan muli.';
      if (status === 502 || status === 503) return 'Hindi muna available ang serbisyo. Pakisubukan muli sa ilang sandali.';
      if (status === 504) return 'Matagal sumagot ang AI service. Pakisubukan muli.';
      return 'Pasensya na, may problema sa koneksyon. Pakitingnan ang internet connection at subukan muli.';
    };

    try {
      let content: string;
      try {
        content = await doFetch();
      } catch (firstErr) {
        if (!isRetryable(firstErr)) throw firstErr;
        await new Promise(r => setTimeout(r, 2000));
        try {
          content = await doFetch();
        } catch (retryErr) {
          throw retryErr;
        }
      }

      // Stamp final timestamp and response time
      const elapsed = Date.now() - startTime;
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, timestamp: new Date(), responseTimeMs: elapsed } : m));
    } catch (err) {
      const elapsed = Date.now() - startTime;
      // Add error as a new assistant message
      const errMsg: YalaMessage = { id: assistantId, role: 'assistant', content: getErrorMessage(err), timestamp: new Date(), responseTimeMs: elapsed };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, participantName]);

  // Expose sendMessage to parent (for sample prompt sidebar)
  useEffect(() => {
    onSendPrompt?.(sendMessage);
  }, [onSendPrompt, sendMessage]);

  const handleSubmit = () => sendMessage(input);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Amber header */}
      <div className="flex items-center gap-3 border-b border-[hsl(38_95%_55%/0.3)] bg-[hsl(38_60%_12%)] px-5 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(38_95%_55%/0.2)]">
          <span className="text-sm font-black text-[hsl(38_95%_65%)]">Y</span>
        </div>
        <div>
          <h2 className="text-sm font-bold text-[hsl(38_95%_75%)]">Y.A.L.A.</h2>
          <p className="text-xs text-[hsl(38_80%_60%)]">Your AI Legislative Assistant</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[hsl(158_64%_45%)] animate-pulse" />
          <span className="text-[10px] font-medium text-[hsl(158_64%_60%)]">Online</span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-5">
          {messages.map(msg => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[80%]">
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'rounded-br-sm bg-[hsl(38_95%_55%)] text-[hsl(222_47%_9%)] font-medium'
                      : 'rounded-bl-sm bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] text-[hsl(214_100%_97%)]'
                  }`}>
                    <p className="whitespace-pre-line">{msg.content}</p>
                  </div>
                  <p className={`mt-1 flex items-center gap-1.5 text-xs text-[hsl(216_20%_45%)] ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span>{formatTimestamp(msg.timestamp)}</span>
                    {!isUser && msg.responseTimeMs != null && msg.id !== 'yala-welcome' && (
                      <span className="text-[hsl(216_20%_35%)]">· {formatResponseTime(msg.responseTimeMs)}</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-[hsl(224_27%_22%)] bg-[hsl(222_47%_9%)] p-4">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question in English or Filipino..."
            disabled={isLoading}
            style={{ fontSize: '16px' }}
            className="flex-1 rounded-xl border border-[hsl(224_27%_25%)] bg-[hsl(224_35%_17%)] px-4 py-3 text-sm text-[hsl(214_100%_97%)] placeholder:text-[hsl(216_20%_40%)] outline-none focus:border-[hsl(38_95%_55%)] focus:ring-1 focus:ring-[hsl(38_95%_55%/0.3)] transition-all disabled:opacity-50"
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(38_95%_55%)] text-[hsl(222_47%_9%)] transition-all hover:bg-[hsl(38_95%_47%)] disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
