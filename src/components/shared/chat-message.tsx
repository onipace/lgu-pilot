'use client';

import type { ChatMessage as ChatMessageType } from '@/types';

interface ChatMessageProps {
  message: ChatMessageType;
  module?: 'ella' | 'yala' | 'obra';
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

function renderContent(content: string) {
  const lines = content.split('\n');

  return lines.map((line, lineIndex) => {
    if (line.trim() === '') return <br key={lineIndex} />;

    const parts: React.ReactNode[] = [];
    let remaining = line;
    let partIndex = 0;

    while (remaining.length > 0) {
      const sectionMatch = remaining.match(/\[Section\s+[\d\w().\-\s]+\]/);
      const sectionTitleMatch = remaining.match(/\[Section\s+[\d\w().\-\s]+-[^\]]+\]/);
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      const matchToUse = sectionTitleMatch || sectionMatch;
      const sectionIdx = matchToUse ? remaining.indexOf(matchToUse[0]) : Infinity;
      const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : Infinity;

      if (sectionIdx === Infinity && boldIdx === Infinity) {
        parts.push(<span key={partIndex++}>{remaining}</span>);
        break;
      }
      if (sectionIdx <= boldIdx && matchToUse) {
        if (sectionIdx > 0) parts.push(<span key={partIndex++}>{remaining.substring(0, sectionIdx)}</span>);
        parts.push(
          <span key={partIndex++} className="mx-0.5 inline-block rounded px-1.5 py-0.5 text-xs font-semibold bg-[hsl(239_76%_64%/0.2)] text-[hsl(239_76%_80%)] border border-[hsl(239_76%_64%/0.3)]">
            {matchToUse[0]}
          </span>
        );
        remaining = remaining.substring(sectionIdx + matchToUse[0].length);
      } else if (boldMatch) {
        if (boldIdx > 0) parts.push(<span key={partIndex++}>{remaining.substring(0, boldIdx)}</span>);
        parts.push(<strong key={partIndex++} className="font-semibold text-white">{boldMatch[1]}</strong>);
        remaining = remaining.substring(boldIdx + boldMatch[0].length);
      }
    }

    return <p key={lineIndex} className="mb-1 last:mb-0">{parts}</p>;
  });
}

export default function ChatMessage({ message, module = 'ella' }: ChatMessageProps) {
  const isUser = message.role === 'user';

  const userBubbleClass =
    module === 'yala'
      ? 'bg-[hsl(38_95%_55%)] text-[hsl(222_47%_9%)]'
      : module === 'obra'
        ? 'bg-[hsl(158_64%_45%)] text-white'
        : 'bg-[hsl(239_76%_64%)] text-white';

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[82%]">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? `${userBubbleClass} rounded-br-sm`
              : 'rounded-bl-sm bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] text-[hsl(214_100%_97%)]'
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="space-y-0.5">{renderContent(message.content)}</div>
          )}
        </div>
        <p className={`mt-1 flex items-center gap-1.5 text-xs text-[hsl(216_20%_45%)] ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span>{formatTimestamp(message.timestamp)}</span>
          {!isUser && message.responseTimeMs != null && (
            <span className="text-[hsl(216_20%_35%)]">· {formatResponseTime(message.responseTimeMs)}</span>
          )}
        </p>
      </div>
    </div>
  );
}
