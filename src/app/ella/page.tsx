'use client';

import { useState } from 'react';
import { Scale, Brain } from 'lucide-react';
import PillarHeader from '@/components/pillar/pillar-header';
import WorkshopBanner from '@/components/pillar/workshop-banner';
import SamplePrompts from '@/components/pillar/sample-prompts';
import ExplainerPanel from '@/components/pillar/explainer-panel';
import EllaChatInterface from '@/components/ella/chat-interface';
import ResponseModeToggle from '@/components/pillar/response-mode-toggle';
import { MODULE_CONFIG, WORKSHOP_SESSION } from '@/lib/workshop-config';
import UserAuthGate from '@/components/pillar/user-auth-gate';
import type { ResponseMode } from '@/lib/ai/response-mode';

export default function EllaPage() {
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [externalPrompt, setExternalPrompt] = useState('');
  const [responseMode, setResponseMode] = useState<ResponseMode>('standard');

  const config = MODULE_CONFIG.ella;

  const handlePromptSelect = (prompt: string) => {
    setExternalPrompt(prompt);
    // Reset after a tick so the effect fires again if same prompt re-selected
    setTimeout(() => setExternalPrompt(''), 100);
  };

  return (
    <UserAuthGate>
    <div className="flex h-screen flex-col bg-[hsl(222_47%_7%)] overflow-hidden">
      <PillarHeader
        module="ella"
        subTopic={config.workshopSubtopic}
        onExplainerOpen={() => setExplainerOpen(true)}
      />
      <WorkshopBanner subTopic={config.workshopSubtopic} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar — sample prompts */}
        <aside className="hidden w-60 flex-col gap-6 border-r border-[hsl(224_27%_22%)] bg-[hsl(222_47%_8%)] p-5 lg:flex overflow-y-auto">
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <Scale className="h-4 w-4 text-[hsl(239_76%_70%)]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-[hsl(239_76%_70%)]">
                E.L.L.A.
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-[hsl(216_20%_50%)]">
              {config.description}
            </p>
          </div>

          <SamplePrompts
            prompts={[...config.samplePrompts]}
            onSelect={handlePromptSelect}
            module="ella"
          />
        </aside>

        {/* Main chat */}
        <main className="flex flex-1 min-w-0 flex-col overflow-hidden">
          <EllaChatInterface externalPrompt={externalPrompt} responseMode={responseMode} />
        </main>
      </div>

      <ExplainerPanel module="ella" open={explainerOpen} onClose={() => setExplainerOpen(false)} />

      {/* Footer attribution */}
      <div className="border-t border-[hsl(224_27%_22%)] bg-[hsl(222_47%_7%)] px-5 py-2 flex items-center justify-between">
        <p className="text-[10px] text-[hsl(216_20%_35%)]">
          {WORKSHOP_SESSION.poweredBy} · {WORKSHOP_SESSION.program} {WORKSHOP_SESSION.module}
        </p>
        <div className="flex items-center gap-3">
          <ResponseModeToggle value={responseMode} onChange={setResponseMode} accentColor="blue" />
          <div className="group relative">
            <Brain className="h-4 w-4 text-[hsl(216_20%_35%)] cursor-pointer transition-colors hover:text-[hsl(239_76%_70%)]" />
            <div className="absolute bottom-full right-0 mb-2 hidden rounded bg-[hsl(222_47%_15%)] px-3 py-1.5 text-xs text-[hsl(216_20%_70%)] shadow-lg group-hover:block whitespace-nowrap border border-[hsl(224_27%_25%)]">
              Model: qwen3.7-plus
            </div>
          </div>
        </div>
      </div>
    </div>
    </UserAuthGate>
  );
}
