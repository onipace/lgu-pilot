'use client';

import { X, BookOpen, Layers, Database } from 'lucide-react';
import { MODULE_CONFIG } from '@/lib/workshop-config';

interface ExplainerPanelProps {
  module: 'ella' | 'obra' | 'yala';
  open: boolean;
  onClose: () => void;
}

export default function ExplainerPanel({
  module,
  open,
  onClose,
}: ExplainerPanelProps) {
  const config = MODULE_CONFIG[module];

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col bg-[hsl(222_47%_7%)] border-l border-[hsl(224_27%_22%)] shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[hsl(224_27%_22%)] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[hsl(214_100%_97%)]">
              {config.name}
            </h2>
            <p className="text-xs text-[hsl(216_20%_55%)]">{config.fullName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(216_20%_55%)] transition-colors hover:bg-[hsl(224_35%_17%)] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Workshop sub-topic */}
          <div className="rounded-lg bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(216_20%_55%)] mb-1">
              Workshop Topic
            </p>
            <p className="text-sm font-medium text-[hsl(214_100%_97%)]">
              {config.workshopSubtopic}
            </p>
          </div>

          {/* How it works steps */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <BookOpen className="h-3.5 w-3.5 text-[hsl(38_95%_55%)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(216_20%_55%)]">
                How It Works
              </span>
            </div>
            <div className="space-y-3">
              {config.explainerSteps.map((step) => (
                <div key={step.step} className="flex gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(239_84%_67%/0.15)] text-xs font-bold text-[hsl(239_76%_80%)]">
                    {step.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[hsl(214_100%_97%)]">
                      {step.title}
                    </p>
                    <p className="text-xs leading-relaxed text-[hsl(216_20%_60%)] mt-0.5">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Knowledge base stats */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Database className="h-3.5 w-3.5 text-[hsl(38_95%_55%)]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(216_20%_55%)]">
                Knowledge Base
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] p-3 text-center">
                <span className="block text-lg font-bold text-[hsl(239_76%_80%)]">
                  {config.knowledgeBase.ra7160}
                </span>
                <span className="text-xs text-[hsl(216_20%_55%)]">RA 7160 Sections</span>
              </div>
              <div className="rounded-lg bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] p-3 text-center">
                <span className="block text-lg font-bold text-[hsl(158_64%_60%)]">
                  {config.knowledgeBase.ordinances}
                </span>
                <span className="text-xs text-[hsl(216_20%_55%)]">Ordinances</span>
              </div>
              <div className="rounded-lg bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] p-3 text-center">
                <span className="block text-lg font-bold text-[hsl(270_70%_75%)]">
                  {config.knowledgeBase.irr}
                </span>
                <span className="text-xs text-[hsl(216_20%_55%)]">IRR Rules</span>
              </div>
              <div className="rounded-lg bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] p-3 text-center">
                <span className="block text-lg font-bold text-[hsl(30_90%_65%)]">
                  {config.knowledgeBase.dilg_opinions}
                </span>
                <span className="text-xs text-[hsl(216_20%_55%)]">DILG Opinions</span>
              </div>
              <div className="rounded-lg bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] p-3 text-center">
                <span className="block text-lg font-bold text-[hsl(340_75%_70%)]">
                  {config.knowledgeBase.jurisprudence}
                </span>
                <span className="text-xs text-[hsl(216_20%_55%)]">SC Jurisprudence</span>
              </div>
              <div className="rounded-lg bg-[hsl(224_35%_17%)] border border-[hsl(224_27%_22%)] p-3 text-center">
                <span className="block text-lg font-bold text-white">
                  {config.knowledgeBase.total.toLocaleString()}
                </span>
                <span className="text-xs text-[hsl(216_20%_55%)]">Total Docs</span>
              </div>
            </div>
          </div>

          {/* Workshop note */}
          <div className="rounded-lg border border-[hsl(38_95%_55%/0.3)] bg-[hsl(38_60%_18%/0.3)] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Layers className="h-3.5 w-3.5 text-[hsl(38_95%_55%)]" />
              <span className="text-xs font-semibold text-[hsl(38_95%_75%)]">
                Workshop Note
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[hsl(38_95%_80%/0.8)]">
              All interactions during this workshop are logged anonymously for
              post-workshop analysis. No personal data is shared externally.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
