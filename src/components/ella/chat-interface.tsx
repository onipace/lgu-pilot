'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';
import type { ChatMessage as ChatMessageType, Citation } from '@/types';
import ChatMessage from '@/components/shared/chat-message';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getOrCreateSessionId } from '@/components/pillar/participant-id';
import CitationViewerModal from '@/components/ella/citation-viewer-modal';

const WELCOME_MESSAGE: ChatMessageType = {
  id: 'ella-welcome',
  role: 'assistant',
  content: `**Welcome to E.L.L.A. — Executive & Legislative Legal Assistant**

I have access to:
- **R.A. 7160** (Local Government Code) — 532 sections
- **IRR of R.A. 7160** — 39 implementing rules
- **1,562 DILG Opinions**
- **161 SC Jurisprudence** rulings
- **349 Pitogo Municipal Ordinances** (1989–2025)

How can I assist you today?`,
  timestamp: new Date(),
};

function generateId(): string {
  return `ella-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function extractCitations(content: string): Citation[] {
  const citations: Citation[] = [];
  const seen = new Set<string>();
  let match;

  const ra7160Strict = /\[Section\s+([\d\w().\-\s]+?)\s*-\s*([^\]]+)\]/g;
  while ((match = ra7160Strict.exec(content)) !== null) {
    const section = match[1].trim();
    const key = `ra7160-${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const after = content.substring(match.index + match[0].length, match.index + match[0].length + 200);
    const firstLine = after.split('\n').filter(l => l.trim())[0] || '';
    citations.push({ section, title: match[2].trim(), text: firstLine.trim().substring(0, 150) || 'Referenced above.', relevance: 90, doc_type: 'ra7160' });
  }

  const ra7160Prose = /Section\s+(\d{3}[A-Za-z]?)(?:\s*\(([^)]+)\))?/gi;
  while ((match = ra7160Prose.exec(content)) !== null) {
    const section = match[1].trim();
    const key = `ra7160-${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({ section, title: match[2]?.trim() || 'R.A. 7160 provision', text: 'Referenced in the analysis above.', relevance: 90, doc_type: 'ra7160' });
  }

  const ordProse = /(?:Municipal\s+Ordinance|MO|AO)\s+No\.?\s*(\d+[-\d]*),?\s*S\.?\s*(\d{4})/gi;
  while ((match = ordProse.exec(content)) !== null) {
    const prefix = 'MO';
    const section = `${prefix} No. ${match[1].trim()}, S. ${match[2]}`;
    const key = `ord-${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({ section, title: 'Pitogo Municipal Ordinance', text: 'Referenced in the analysis.', relevance: 85, doc_type: 'ordinance' });
  }

  return citations;
}

function VerificationBadge({ verified, confidence }: { verified?: boolean; confidence?: 'high' | 'medium' | 'low' }) {
  if (verified === undefined) return null;

  if (verified && confidence === 'high') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-400">
        <ShieldCheck className="h-3 w-3" /> Verified
      </span>
    );
  }
  if (verified && confidence === 'medium') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-400">
        <ShieldAlert className="h-3 w-3" /> Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-400">
      <ShieldX className="h-3 w-3" /> Unverified
    </span>
  );
}

interface EllaChatInterfaceProps {
  externalPrompt?: string;
  participantName?: string | null;
  responseMode?: 'brief' | 'standard' | 'detailed';
}

export default function EllaChatInterface({ externalPrompt, participantName, responseMode }: EllaChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // External prompt injection (from sample prompts sidebar)
  useEffect(() => {
    if (externalPrompt) {
      setInput(externalPrompt);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [externalPrompt]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessageType = { id: generateId(), role: 'user', content: trimmed, timestamp: new Date() };
    const assistantId = generateId();

    // Only add user message — assistant message appears when content arrives
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const startTime = Date.now();

    const doFetch = async (): Promise<{ content: string; citations: Citation[] | null }> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000); // 60s timeout

      try {
        const history = messages.filter(m => m.id !== 'ella-welcome').map(m => ({ role: m.role, content: m.content }));
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module: 'ella',
            message: trimmed,
            history,
            participantName: participantName || undefined,
            sessionId: getOrCreateSessionId(),
            responseMode: responseMode || 'standard',
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = new Error(`API error: ${response.status}`) as Error & { status?: number };
          err.status = response.status;
          throw err;
        }

        let fullContent = '';
        let serverCitations: Citation[] | null = null;
        let messageCreated = false;
        let thinkingStarted = false;

        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith('data: ') || trimmedLine.includes('[DONE]')) continue;
              try {
                const parsed = JSON.parse(trimmedLine.slice(6));
                if (parsed.thinking) {
                  // Handle thinking/reasoning chunks
                  if (!thinkingStarted) {
                    thinkingStarted = true;
                  }
                }
                if (parsed.text) {
                  if (thinkingStarted) {
                    thinkingStarted = false;
                  }
                  fullContent += parsed.text;
                  if (!messageCreated) {
                    // Create assistant message on first text chunk
                    const msg: ChatMessageType = { id: assistantId, role: 'assistant', content: fullContent, timestamp: new Date() };
                    setMessages(prev => [...prev, msg]);
                    messageCreated = true;
                  } else {
                    setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m));
                  }
                }
                if (parsed.citations) serverCitations = parsed.citations as Citation[];
              } catch { /* skip malformed JSON */ }
            }
          }
        }

        // Ensure message exists even if stream had no text (edge case)
        if (!messageCreated) {
          const msg: ChatMessageType = { id: assistantId, role: 'assistant', content: fullContent || 'No response received.', timestamp: new Date() };
          setMessages(prev => [...prev, msg]);
        }

        return { content: fullContent, citations: serverCitations };
      } finally {
        clearTimeout(timeout);
      }
    };

    const isRetryable = (err: unknown): boolean => {
      if (err instanceof Error && err.name === 'AbortError') return false; // timeout — don't retry
      const status = (err as { status?: number })?.status;
      return !status || status === 429 || status === 502 || status === 503 || status === 504;
    };

    const getErrorMessage = (err: unknown): string => {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'The request timed out. The AI service may be under heavy load — please try again in a moment.';
      }
      const status = (err as { status?: number })?.status;
      if (status === 429) return 'The AI service is currently rate-limited. Please wait a few seconds and try again.';
      if (status === 502 || status === 503) return 'The backend service is temporarily unavailable. Please try again shortly.';
      if (status === 504) return 'The AI service took too long to respond. Please try again.';
      return 'I encountered a connection error. Please check your internet connection and try again.';
    };

    try {
      let result: { content: string; citations: Citation[] | null };
      try {
        result = await doFetch();
      } catch (firstErr) {
        if (!isRetryable(firstErr)) throw firstErr;
        // Retry once after a short delay
        await new Promise(r => setTimeout(r, 2000));
        try {
          result = await doFetch();
        } catch (retryErr) {
          throw retryErr;
        }
      }

      // Use server-side citations if available, otherwise fall back to client-side extraction
      const finalCitations = result.citations || extractCitations(result.content);
      if (finalCitations.length > 0) setCitations(prev => [...finalCitations, ...prev]);

      // Stamp final timestamp and response time on the assistant message
      const elapsed = Date.now() - startTime;
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, timestamp: new Date(), responseTimeMs: elapsed } : m));
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errorMsg = getErrorMessage(err);
      // Add error as assistant message (no blank bubble was shown)
      const errMsg: ChatMessageType = { id: assistantId, role: 'assistant', content: errorMsg, timestamp: new Date(), responseTimeMs: elapsed };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const docTypeConfig: Record<string, { label: string; bg: string }> = {
    ra7160: { label: 'R.A. 7160', bg: 'bg-[hsl(239_76%_64%/0.15)] text-[hsl(239_76%_80%)]' },
    ordinance: { label: 'Ordinance', bg: 'bg-[hsl(158_64%_45%/0.15)] text-[hsl(158_64%_70%)]' },
    irr: { label: 'IRR', bg: 'bg-[hsl(270_70%_60%/0.15)] text-[hsl(270_70%_80%)]' },
    dilg_opinion: { label: 'DILG Op.', bg: 'bg-[hsl(30_90%_50%/0.15)] text-[hsl(30_90%_70%)]' },
    jurisprudence: { label: 'SC Case', bg: 'bg-[hsl(340_75%_55%/0.15)] text-[hsl(340_75%_75%)]' },
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Main chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 p-5">
            {messages.map(msg => <ChatMessage key={msg.id} message={msg} module="ella" />)}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3 rounded-2xl rounded-bl-sm bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </div>
                  <span className="text-[11px] tabular-nums text-[hsl(216_20%_40%)]">{elapsedSec}s</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-[hsl(224_27%_22%)] bg-[hsl(222_47%_9%)] p-4">
          <div className="flex items-end gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about R.A. 7160, local government powers, ordinances..."
              rows={2}
              disabled={isLoading}
              className="flex-1 resize-none bg-[hsl(224_35%_17%)] border-[hsl(224_27%_25%)] text-[hsl(214_100%_97%)] placeholder:text-[hsl(216_20%_40%)] focus:border-[hsl(239_84%_67%)] focus:ring-[hsl(239_84%_67%/0.2)]"
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-[hsl(239_76%_64%)] text-white hover:bg-[hsl(239_76%_56%)] disabled:opacity-40 transition-all"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Citations sidebar */}
      <div className="hidden w-72 flex-col border-l border-[hsl(224_27%_22%)] bg-[hsl(222_47%_8%)] lg:flex">
        <div className="border-b border-[hsl(224_27%_22%)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[hsl(214_100%_97%)]">Legal Citations</h2>
          <p className="text-xs text-[hsl(216_20%_50%)]">{citations.length} reference{citations.length !== 1 ? 's' : ''} found</p>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-3 p-4">
            {citations.length === 0 ? (
              <p className="py-8 text-center text-xs text-[hsl(216_20%_45%)]">Citations will appear here as you ask questions.</p>
            ) : citations.map((c, i) => {
              const cfg = docTypeConfig[c.doc_type || 'ra7160'] || docTypeConfig.ra7160;
              const isUnverified = c.verified === false;
              return (
                <button
                  key={`${c.section}-${i}`}
                  onClick={() => setSelectedCitation(c)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors cursor-pointer ${
                    isUnverified
                      ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50 hover:bg-red-500/10'
                      : 'border-[hsl(224_27%_22%)] bg-[hsl(224_35%_17%)] hover:border-[hsl(239_76%_50%)] hover:bg-[hsl(224_35%_20%)]'
                  }`}
                >
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg.bg}`}>{cfg.label}</span>
                      <span className="text-xs font-bold text-[hsl(214_100%_97%)]">{c.section}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <VerificationBadge verified={c.verified} confidence={c.confidence} />
                      {c.verified !== false && (
                        <Badge className="bg-[hsl(158_64%_45%/0.2)] text-[hsl(158_64%_70%)] text-[10px]">{Math.round(c.relevance * 100)}%</Badge>
                      )}
                    </div>
                  </div>
                  <p className="mb-1 text-xs font-medium text-[hsl(239_76%_80%)]">{c.title}</p>
                  <Separator className="my-1.5 bg-[hsl(224_27%_22%)]" />
                  <p className="line-clamp-3 text-xs leading-relaxed text-[hsl(216_20%_55%)]">{c.text}</p>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <CitationViewerModal
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
}
