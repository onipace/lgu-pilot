'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Database, Brain, Clock } from 'lucide-react';
import type { ChatMessage as ChatMessageType, Citation } from '@/types';
import ChatMessage from '@/components/shared/chat-message';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { getOrCreateSessionId } from '@/components/pillar/participant-id';
import type { ResponseMode } from '@/lib/ai/response-mode';
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

  // DILG Legal Opinions (bracketed: [DILG LO No. 022, S. 2018 - Title])
  const dilgStrict = /\[DILG\s+LO\s+No\.?\s*(\d+),?\s*S\.?\s*(\d{4})\s*-\s*([^\]]+)\]/gi;
  while ((match = dilgStrict.exec(content)) !== null) {
    const section = `LO No. ${match[1]}, S. ${match[2]}`;
    const key = `dilg-${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({ section, title: match[3].trim(), text: 'Referenced in the analysis above.', relevance: 85, doc_type: 'dilg_opinion' });
  }

  // DILG Legal Opinions (prose: DILG LO No. 022, S. 2018)
  const dilgProse = /DILG\s+(?:LO|Legal\s+Opinion)\s+No\.?\s*(\d+),?\s*S\.?\s*(\d{4})/gi;
  while ((match = dilgProse.exec(content)) !== null) {
    const section = `LO No. ${match[1]}, S. ${match[2]}`;
    const key = `dilg-${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({ section, title: 'DILG Legal Opinion', text: 'Referenced in the analysis above.', relevance: 80, doc_type: 'dilg_opinion' });
  }

  // SC Jurisprudence (bracketed: [G.R. No. 182969 - Case Name (Year)])
  const scStrict = /\[G\.?\s*R\.?\s+No\.?\s*(\d{4,6}(?:-\d+)?)\s*-\s*([^\]]+)\]/gi;
  while ((match = scStrict.exec(content)) !== null) {
    const section = `G.R. No. ${match[1]}`;
    const key = `sc-${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({ section, title: match[2].trim(), text: 'Referenced in the analysis above.', relevance: 85, doc_type: 'jurisprudence' });
  }

  // SC Jurisprudence (prose: G.R. No. 182969)
  const scProse = /G\.?\s*R\.?\s+No\.?\s*(\d{4,6}(?:-\d+)?)/gi;
  while ((match = scProse.exec(content)) !== null) {
    const section = `G.R. No. ${match[1]}`;
    const key = `sc-${section}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({ section, title: 'Supreme Court Decision', text: 'Referenced in the analysis above.', relevance: 80, doc_type: 'jurisprudence' });
  }

  return citations.map(c => ({ ...c, source: 'llm' as const }));
}

function SourceBadge({ source, relevanceRating }: { source?: "kb" | "llm"; relevanceRating?: "high" | "medium" | "low" }) {
  if (source === "kb") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold bg-sky-500/20 text-sky-400">
        <Database className="h-3 w-3" /> KB
      </span>
    );
  }
  if (source === "llm") {
    const dots = relevanceRating === "high" ? 3 : relevanceRating === "medium" ? 2 : 1;
    if (relevanceRating === "high") {
      return (
        <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-400">
          <Brain className="h-3 w-3" /> LLM
          <span className="ml-0.5 flex gap-px">
            {[1, 2, 3].map(i => <span key={i} className={`w-1 h-1 rounded-full ${i <= dots ? 'bg-amber-400' : 'bg-amber-400/30'}`} />)}
          </span>
        </span>
      );
    }
    if (relevanceRating === "medium") {
      return (
        <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold bg-orange-500/20 text-orange-400">
          <Brain className="h-3 w-3" /> LLM
          <span className="ml-0.5 flex gap-px">
            {[1, 2, 3].map(i => <span key={i} className={`w-1 h-1 rounded-full ${i <= dots ? 'bg-orange-400' : 'bg-orange-400/30'}`} />)}
          </span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-400">
        <Brain className="h-3 w-3" /> LLM
        <span className="ml-0.5 flex gap-px">
          {[1, 2, 3].map(i => <span key={i} className={`w-1 h-1 rounded-full ${i <= dots ? 'bg-red-400' : 'bg-red-400/30'}`} />)}
        </span>
      </span>
    );
  }
  return null;
}

interface EllaChatInterfaceProps {
  externalPrompt?: string;
  participantName?: string | null;
  responseMode?: ResponseMode;
}

export default function EllaChatInterface({ externalPrompt, participantName, responseMode }: EllaChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [showTimeoutPrompt, setShowTimeoutPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setThinkingText('');
    setIsThinking(false);
    setShowTimeoutPrompt(false);

    const startTime = Date.now();

    const doFetch = async (): Promise<{ content: string; citations: Citation[] | null }> => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const setupTimeout = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setShowTimeoutPrompt(true), 120_000);
      };
      setupTimeout();

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
            responseMode,
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
                  if (!thinkingStarted) { thinkingStarted = true; setIsThinking(true); }
                  setThinkingText(prev => (prev + parsed.thinking).slice(-500));
                }
                if (parsed.text) {
                  if (thinkingStarted) { thinkingStarted = false; setIsThinking(false); }
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
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      }
    };

    const isRetryable = (err: unknown): boolean => {
      if (err instanceof Error && err.name === 'AbortError') return false; // timeout — don't retry
      const status = (err as { status?: number })?.status;
      return !status || status === 429 || status === 502 || status === 503 || status === 504;
    };

    const getErrorMessage = (err: unknown): string => {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'Request cancelled. You can try asking again or rephrase your question.';
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
      setIsThinking(false);
      setThinkingText('');
      setShowTimeoutPrompt(false);
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const handleContinueWaiting = () => {
    setShowTimeoutPrompt(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShowTimeoutPrompt(true), 120_000);
  };

  const handleCancelWait = () => {
    setShowTimeoutPrompt(false);
    abortControllerRef.current?.abort();
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
              <div className="flex flex-col gap-2 items-start">
                <div className="flex items-center gap-3 rounded-2xl rounded-bl-sm bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {isThinking && <Brain className="h-3.5 w-3.5 text-[hsl(239_76%_70%)] animate-pulse" />}
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </div>
                  <span className="text-[11px] tabular-nums text-[hsl(216_20%_40%)]">
                    {isThinking ? 'Thinking' : 'Working'}... {elapsedSec}s
                  </span>
                </div>
                {isThinking && thinkingText && (
                  <div className="max-w-[82%] rounded-xl border-l-2 border-[hsl(239_76%_50%/0.4)] bg-[hsl(224_35%_14%)] px-3 py-2 max-h-24 overflow-y-auto">
                    <p className="text-[11px] italic leading-relaxed text-[hsl(216_20%_45%)] line-clamp-4">
                      {thinkingText.slice(-300)}
                    </p>
                  </div>
                )}
                {showTimeoutPrompt && (
                  <div className="flex items-center gap-3 rounded-xl border border-[hsl(38_95%_55%/0.3)] bg-[hsl(38_60%_12%)] px-4 py-3 max-w-[82%]">
                    <Clock className="h-4 w-4 text-[hsl(38_95%_65%)] shrink-0" />
                    <span className="text-xs text-[hsl(38_80%_70%)] flex-1">
                      E.L.L.A. is still analyzing legal citations and case law. Continue waiting?
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleContinueWaiting}
                        className="rounded-lg bg-[hsl(158_64%_35%)] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[hsl(158_64%_30%)] transition-colors"
                      >
                        Continue
                      </button>
                      <button
                        onClick={handleCancelWait}
                        className="rounded-lg border border-[hsl(0_72%_50%/0.4)] bg-[hsl(0_72%_50%/0.1)] px-3 py-1.5 text-[11px] font-semibold text-[hsl(0_72%_70%)] hover:bg-[hsl(0_72%_50%/0.2)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
              const source = c.source || (c.verified === false ? 'llm' : c.verified ? 'kb' : undefined);
              const isLLM = source === 'llm';
              return (
                <button
                  key={`${c.section}-${i}`}
                  onClick={() => setSelectedCitation(c)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors cursor-pointer ${
                    isLLM
                      ? c.relevance_rating === 'high'
                        ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10'
                        : c.relevance_rating === 'medium'
                          ? 'border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50 hover:bg-orange-500/10'
                          : 'border-red-500/30 bg-red-500/5 hover:border-red-500/50 hover:bg-red-500/10'
                      : 'border-[hsl(224_27%_22%)] bg-[hsl(224_35%_17%)] hover:border-[hsl(239_76%_50%)] hover:bg-[hsl(224_35%_20%)]'
                  }`}
                >
                  <div className="mb-1.5 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg.bg}`}>{cfg.label}</span>
                      <span className="text-xs font-bold text-[hsl(214_100%_97%)]">{c.section}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <SourceBadge source={source} relevanceRating={c.relevance_rating} />
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
