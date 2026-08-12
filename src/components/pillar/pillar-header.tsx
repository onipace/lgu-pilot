'use client';

import Link from 'next/link';
import { Info, ArrowLeft } from 'lucide-react';
import { WORKSHOP_SESSION } from '@/lib/workshop-config';

interface PillarHeaderProps {
  module: 'ella' | 'obra' | 'yala' | 'landing';
  subTopic?: string;
  onExplainerOpen?: () => void;
}

const MODULE_LABELS: Record<string, string> = {
  ella: 'E.L.L.A.',
  obra: 'O.B.R.A.',
  yala: 'Y.A.L.A.',
  landing: 'eSANGGUNI Workshop',
};

export default function PillarHeader({
  module,
  subTopic,
  onExplainerOpen,
}: PillarHeaderProps) {
  const isToolPage = module !== 'landing';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[hsl(224_27%_22%)] bg-[hsl(222_47%_7%)] px-4 lg:px-6">
      {/* Left — logo + back nav */}
      <div className="flex items-center gap-3">
        {isToolPage && (
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[hsl(216_20%_55%)] transition-colors hover:bg-[hsl(224_35%_17%)] hover:text-[hsl(214_100%_97%)] cursor-pointer"
            aria-label="Back to Menu"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">Back to Menu</span>
          </Link>
        )}

        <div className="flex items-center gap-2">
          {/* eSANGGUNI wordmark */}
          <span className="font-bold tracking-wider text-[hsl(38_95%_55%)] text-base lg:text-lg">
            eSANGGUNI
          </span>
          <span className="hidden text-[hsl(224_27%_22%)] sm:inline">|</span>
          <span className="hidden text-xs text-[hsl(216_20%_55%)] sm:inline">
            {WORKSHOP_SESSION.module} · {WORKSHOP_SESSION.title}
          </span>
        </div>

        {isToolPage && (
          <>
            <span className="text-[hsl(224_27%_28%)]">/</span>
            <span className="text-sm font-semibold text-[hsl(214_100%_97%)]">
              {MODULE_LABELS[module]}
            </span>
          </>
        )}
      </div>

      {/* Right — sub-topic + explainer trigger */}
      <div className="flex items-center gap-3">
        {subTopic && (
          <span className="hidden text-xs text-[hsl(216_20%_50%)] xl:block max-w-xs truncate">
            {subTopic}
          </span>
        )}
        {isToolPage && onExplainerOpen && (
          <button
            onClick={onExplainerOpen}
            className="flex items-center gap-1.5 rounded-lg border border-[hsl(224_27%_25%)] px-3 py-1.5 text-xs font-medium text-[hsl(216_20%_65%)] transition-all hover:border-[hsl(239_84%_67%/0.5)] hover:text-[hsl(239_84%_80%)] hover:bg-[hsl(239_84%_67%/0.08)]"
          >
            <Info className="h-3.5 w-3.5" />
            How it works
          </button>
        )}

        {/* eSANGGUNI attribution */}
        <span className="hidden text-[10px] font-medium tracking-wide text-[hsl(216_20%_40%)] lg:block uppercase">
          powered by BAYANAIHAN
        </span>
      </div>
    </header>
  );
}
