'use client';

import Link from 'next/link';
import { Info, ChevronRight } from 'lucide-react';
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
      {/* Left — brand + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {/* eSANGGUNI wordmark — clickable, returns to landing/home (industry convention) */}
        <Link
          href="/"
          className="shrink-0 font-bold tracking-wider text-[hsl(38_95%_55%)] text-base lg:text-lg hover:text-[hsl(38_95%_65%)] transition-colors"
          aria-label="eSANGGUNI Home"
        >
          eSANGGUNI
        </Link>

        {isToolPage ? (
          <>
            <span className="hidden text-[hsl(224_27%_28%)] sm:inline">|</span>
            <span className="hidden text-xs text-[hsl(216_20%_55%)] sm:inline truncate">
              {WORKSHOP_SESSION.module} · {WORKSHOP_SESSION.title}
            </span>

            {/* Breadcrumb: Home > Menu > Current Tool */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm ml-2 min-w-0">
              <Link
                href="/"
                className="text-[hsl(216_20%_55%)] hover:text-[hsl(214_100%_97%)] transition-colors"
                aria-label="Home (Landing)"
              >
                <span className="hidden md:inline">Home</span>
                <span className="md:hidden">Home</span>
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-[hsl(224_27%_35%)] shrink-0" aria-hidden />
              <Link
                href="/dashboard"
                className="text-[hsl(216_20%_55%)] hover:text-[hsl(214_100%_97%)] transition-colors"
                aria-label="Back to Menu"
              >
                Menu
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-[hsl(224_27%_35%)] shrink-0" aria-hidden />
              <span className="font-semibold text-[hsl(214_100%_97%)] truncate">
                {MODULE_LABELS[module]}
              </span>
            </nav>
          </>
        ) : (
          <span className="hidden text-[hsl(224_27%_22%)] sm:inline">|</span>
        )}

        {!isToolPage && (
          <span className="hidden text-xs text-[hsl(216_20%_55%)] sm:inline">
            {WORKSHOP_SESSION.module} · {WORKSHOP_SESSION.title}
          </span>
        )}
      </div>

      {/* Right — sub-topic + explainer trigger */}
      <div className="flex items-center gap-3 shrink-0">
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
