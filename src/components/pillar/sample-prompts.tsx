'use client';

import { Zap } from 'lucide-react';

interface SamplePromptsProps {
  prompts: { label: string; prompt: string }[];
  onSelect: (prompt: string) => void;
  module?: 'ella' | 'obra' | 'yala';
  title?: string;
}

export default function SamplePrompts({
  prompts,
  onSelect,
  module = 'ella',
  title = 'Try these prompts',
}: SamplePromptsProps) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-[hsl(38_95%_55%)]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(216_20%_55%)]">
          {title}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {prompts.map((p) => (
          <button
            key={p.prompt}
            onClick={() => onSelect(p.prompt)}
            className={`prompt-pill text-left ${module}`}
          >
            {p.prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
