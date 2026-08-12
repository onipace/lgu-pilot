'use client';

import { RESPONSE_MODE_CONFIG, type ResponseMode } from '@/lib/ai/response-mode';

interface ResponseModeToggleProps {
  value: ResponseMode;
  onChange: (mode: ResponseMode) => void;
  accentColor?: 'blue' | 'amber';
}

const ACCENT_STYLES = {
  blue: {
    active: 'bg-[hsl(239_76%_64%)] text-white',
    inactive: 'text-[hsl(216_20%_45%)] hover:text-[hsl(216_20%_65%)]',
  },
  amber: {
    active: 'bg-[hsl(38_95%_55%)] text-[hsl(222_47%_9%)]',
    inactive: 'text-[hsl(216_20%_45%)] hover:text-[hsl(216_20%_65%)]',
  },
};

const MODE_ORDER: ResponseMode[] = ['brief', 'standard', 'detailed'];

export default function ResponseModeToggle({
  value,
  onChange,
  accentColor = 'blue',
}: ResponseModeToggleProps) {
  const styles = ACCENT_STYLES[accentColor];

  return (
    <div className="flex items-center gap-px rounded-lg border border-[hsl(224_27%_22%)] bg-[hsl(222_47%_9%)] p-0.5">
      {MODE_ORDER.map((mode) => {
        const cfg = RESPONSE_MODE_CONFIG[mode];
        const isActive = value === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
              isActive ? styles.active : styles.inactive
            }`}
            title={`~${cfg.wordLimit} words, ${cfg.citationLimit ? `max ${cfg.citationLimit}` : `${cfg.citationCount}+`} citations`}
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}
