'use client';

import { useState } from 'react';
import { FilePlus, FileSearch, Brain } from 'lucide-react';
import PillarHeader from '@/components/pillar/pillar-header';
import WorkshopBanner from '@/components/pillar/workshop-banner';
import ExplainerPanel from '@/components/pillar/explainer-panel';
import DraftWizard from '@/components/obra/draft-wizard';
import DraftReviewer from '@/components/obra/draft-reviewer';
import { cn } from '@/lib/utils';
import { MODULE_CONFIG, WORKSHOP_SESSION } from '@/lib/workshop-config';
import UserAuthGate from '@/components/pillar/user-auth-gate';

type ObraTab = 'draft' | 'review';

const TABS: { value: ObraTab; label: string; icon: typeof FilePlus; hint: string }[] = [
  { value: 'draft',  label: 'Create New Ordinance', icon: FilePlus,    hint: 'Draft a new ordinance from a template with AI assistance' },
  { value: 'review', label: 'Review Existing Draft', icon: FileSearch, hint: 'Paste an existing draft and analyze it for compliance' },
];

export default function ObraPage() {
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ObraTab>('draft');
  const config = MODULE_CONFIG.obra;

  return (
    <UserAuthGate>
    <div className="flex h-screen flex-col bg-[hsl(222_47%_7%)] overflow-hidden">
      <PillarHeader
        module="obra"
        subTopic={config.workshopSubtopic}
        onExplainerOpen={() => setExplainerOpen(true)}
      />
      <WorkshopBanner subTopic={config.workshopSubtopic} />

      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-4">
          {/* Horizontal button-group switcher */}
          <div className="mb-1 inline-flex rounded-xl border border-[hsl(224_27%_22%)] bg-[hsl(224_35%_13%)] p-1">
            {TABS.map(({ value, label, icon: Icon }) => {
              const isActive = activeTab === value;
              return (
                <button
                  key={value}
                  onClick={() => setActiveTab(value)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-[hsl(158_64%_45%)] text-white shadow-sm'
                      : 'text-[hsl(216_20%_55%)] hover:text-[hsl(214_100%_90%)]'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Context hint */}
          <p className="mb-4 text-xs text-[hsl(216_20%_40%)]">
            {TABS.find(t => t.value === activeTab)?.hint}
          </p>

          {activeTab === 'draft'  && <DraftWizard />}
          {activeTab === 'review' && <DraftReviewer />}
        </div>
      </main>

      <ExplainerPanel module="obra" open={explainerOpen} onClose={() => setExplainerOpen(false)} />

      <div className="border-t border-[hsl(224_27%_22%)] bg-[hsl(222_47%_7%)] px-5 py-2 flex items-center justify-between">
        <p className="text-[10px] text-[hsl(216_20%_35%)]">
          {WORKSHOP_SESSION.poweredBy} · {WORKSHOP_SESSION.program} {WORKSHOP_SESSION.module}
        </p>
        <div className="group relative">
          <Brain className="h-4 w-4 text-[hsl(216_20%_35%)] cursor-pointer transition-colors hover:text-[hsl(239_76%_70%)]" />
          <div className="absolute bottom-full right-0 mb-2 hidden rounded bg-[hsl(222_47%_15%)] px-3 py-1.5 text-xs text-[hsl(216_20%_70%)] shadow-lg group-hover:block whitespace-nowrap border border-[hsl(224_27%_25%)]">
            Model: qwen3.7-plus
          </div>
        </div>
      </div>
    </div>
    </UserAuthGate>
  );
}
