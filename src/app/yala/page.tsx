'use client';

import { useState, useRef, useCallback } from 'react';
import { MessageCircle, Lightbulb, Brain } from 'lucide-react';
import PillarHeader from '@/components/pillar/pillar-header';
import WorkshopBanner from '@/components/pillar/workshop-banner';
import SamplePrompts from '@/components/pillar/sample-prompts';
import ExplainerPanel from '@/components/pillar/explainer-panel';
import YalaChat from '@/components/yala/yala-chat';
import ResponseModeToggle from '@/components/pillar/response-mode-toggle';
import { MODULE_CONFIG, WORKSHOP_SESSION } from '@/lib/workshop-config';
import UserAuthGate from '@/components/pillar/user-auth-gate';
import type { ResponseMode } from '@/lib/ai/response-mode';

export default function YalaPage() {
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [promptsPanelOpen, setPromptsPanelOpen] = useState(false);
  const [responseMode, setResponseMode] = useState<ResponseMode>('standard');
  const sendMessageRef = useRef<((text: string) => void) | null>(null);

  const config = MODULE_CONFIG.yala;

  const handleSendPromptReady = useCallback((fn: (text: string) => void) => {
    sendMessageRef.current = fn;
  }, []);

  const handlePromptSelect = (prompt: string) => {
    sendMessageRef.current?.(prompt);
    setPromptsPanelOpen(false);
  };

  return (
    <UserAuthGate>
    <div className="flex h-screen flex-col bg-[hsl(222_47%_7%)] overflow-hidden">
      <PillarHeader
        module="yala"
        subTopic={config.workshopSubtopic}
        onExplainerOpen={() => setExplainerOpen(true)}
      />
      <WorkshopBanner subTopic={config.workshopSubtopic} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar — desktop only */}
        <aside className="hidden w-64 flex-col gap-6 border-r border-[hsl(224_27%_22%)] bg-[hsl(222_47%_8%)] p-5 lg:flex overflow-y-auto">
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-[hsl(38_95%_65%)]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-[hsl(38_95%_65%)]">
                Y.A.L.A.
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-[hsl(216_20%_50%)]">
              {config.description}
            </p>
          </div>

          <SamplePrompts
            prompts={[...config.samplePrompts]}
            onSelect={handlePromptSelect}
            module="yala"
            title="Try asking"
          />
        </aside>

        {/* Main chat */}
        <main className="flex flex-1 min-w-0 flex-col overflow-hidden">
          <YalaChat onSendPrompt={handleSendPromptReady} responseMode={responseMode} />

          {/* Mobile quick prompts button */}
          <button
            onClick={() => setPromptsPanelOpen(true)}
            className="absolute bottom-24 left-4 flex items-center gap-1.5 rounded-full border border-[hsl(38_95%_55%/0.4)] bg-[hsl(38_60%_12%)] px-3 py-2 text-xs font-medium text-[hsl(38_95%_65%)] shadow-lg transition-all hover:bg-[hsl(38_60%_18%)] lg:hidden"
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Try prompts
          </button>
        </main>
      </div>

      {/* Mobile prompts sheet */}
      {promptsPanelOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-[hsl(224_27%_22%)] bg-[hsl(222_47%_9%)] p-5 shadow-2xl lg:hidden">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[hsl(214_100%_97%)]">Sample Prompts</h3>
            <button onClick={() => setPromptsPanelOpen(false)} className="text-xs text-[hsl(216_20%_55%)] hover:text-white">Close</button>
          </div>
          <SamplePrompts prompts={[...config.samplePrompts]} onSelect={handlePromptSelect} module="yala" />
        </div>
      )}

      <ExplainerPanel module="yala" open={explainerOpen} onClose={() => setExplainerOpen(false)} />

      <div className="border-t border-[hsl(224_27%_22%)] bg-[hsl(222_47%_7%)] px-5 py-2 flex items-center justify-between">
        <p className="text-[10px] text-[hsl(216_20%_35%)]">
          {WORKSHOP_SESSION.poweredBy} · {WORKSHOP_SESSION.program} {WORKSHOP_SESSION.module}
        </p>
        <div className="flex items-center gap-3">
          <ResponseModeToggle value={responseMode} onChange={setResponseMode} accentColor="amber" />
          <div className="group relative">
            <Brain className="h-4 w-4 text-[hsl(216_20%_35%)] cursor-pointer transition-colors hover:text-[hsl(38_95%_65%)]" />
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
