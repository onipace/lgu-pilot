'use client';

import { useState } from 'react';
import { RESPONSE_MODE_CONFIG, type ResponseMode } from '@/lib/ai/response-mode';
import { deriveMaxTokens } from '@/lib/ai/model-calibration';

interface ResponseModeToggleProps {
  value: ResponseMode;
  onChange: (mode: ResponseMode) => void;
  accentColor?: 'blue' | 'amber';
  /**
   * Primary model ID used for the tooltip's derived-token-budget preview.
   * Defaults to the production chain's first entry (qwen3.7-plus).
   * When the circuit-breaker falls through, budgets are recomputed for
   * the actual serving model — this is an approximate preview.
   */
  primaryModel?: string;
}

const ACCENT_STYLES = {
  blue: {
    active: 'bg-[hsl(239_76%_64%)] text-white',
    inactive: 'text-[hsl(216_20%_45%)] hover:text-[hsl(216_20%_65%)]',
    tooltipBorder: 'border-[hsl(239_76%_50%)]',
  },
  amber: {
    active: 'bg-[hsl(38_95%_55%)] text-[hsl(222_47%_9%)]',
    inactive: 'text-[hsl(216_20%_45%)] hover:text-[hsl(216_20%_65%)]',
    tooltipBorder: 'border-[hsl(38_95%_45%)]',
  },
};

const MODE_ORDER: ResponseMode[] = ['brief', 'standard', 'detailed'];

const DEFAULT_PRIMARY_MODEL = 'qwen/qwen3.7-plus';

export default function ResponseModeToggle({
  value,
  onChange,
  accentColor = 'blue',
  primaryModel = DEFAULT_PRIMARY_MODEL,
}: ResponseModeToggleProps) {
  const styles = ACCENT_STYLES[accentColor];
  const [hovered, setHovered] = useState<ResponseMode | null>(null);

  return (
    <div className="relative flex items-center gap-px rounded-lg border border-[hsl(224_27%_22%)] bg-[hsl(222_47%_9%)] p-0.5">
      {MODE_ORDER.map((mode) => {
        const cfg = RESPONSE_MODE_CONFIG[mode];
        const isActive = value === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            onMouseEnter={() => setHovered(mode)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(mode)}
            onBlur={() => setHovered(null)}
            className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all ${
              isActive ? styles.active : styles.inactive
            }`}
            aria-label={`${cfg.label}: about ${cfg.wordLimit} words`}
          >
            {cfg.label}
          </button>
        );
      })}

      {/* PILLAR-styled hover tooltip — matches the Brain-icon tooltip pattern already in the footer */}
      {hovered && (() => {
        const cfg = RESPONSE_MODE_CONFIG[hovered];
        const derivedTokens = deriveMaxTokens(cfg.wordLimit, primaryModel);
        const citationText = cfg.citationLimit
          ? `exactly ${cfg.citationLimit}`
          : `${cfg.citationCount}+`;
        return (
          <div
            role="tooltip"
            className={`pointer-events-none absolute bottom-full right-0 mb-2 min-w-[16rem] rounded border ${styles.tooltipBorder} bg-[hsl(222_47%_15%)] px-3 py-2 text-xs text-[hsl(216_20%_70%)] shadow-lg`}
          >
            <div className="mb-1 font-semibold text-white">
              {cfg.label} response
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] text-[hsl(216_20%_60%)]">
              <div>Word budget</div>
              <div className="text-right font-mono text-[hsl(216_100%_90%)]">
                ~{cfg.wordLimit} words
              </div>
              <div>Citations</div>
              <div className="text-right font-mono text-[hsl(216_100%_90%)]">
                {citationText}
              </div>
              <div>Token ceiling</div>
              <div className="text-right font-mono text-[hsl(216_100%_90%)]">
                {derivedTokens} tok ({primaryModel.split('/').pop()})
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
