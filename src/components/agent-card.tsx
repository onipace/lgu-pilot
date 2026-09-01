'use client';

import { Loader2, Check, AlertTriangle, Hand, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgentState } from '@/types/agentic';

/**
 * AgentCard — shared, module-neutral agent card for the LIKHA/LINAW agentic kit.
 * Strictly prop-driven: receives one AgentState and renders it. No business
 * logic (no fetch, no timers, no DB), no module branching.
 *
 * Styling contract (DESIGN.md §5):
 * - Auto-height w-40 card, dark panel bg #1E293B; the pipeline row stretches
 *   cards to a uniform height (2026-08-13 polish: user wanted no dead space —
 *   idle card shows only icon + label).
 * - Circular number badge at -top-3 -left-3 in the agent's hex color.
 * - Status icon top-right (Loader2/Check/AlertTriangle/Hand), idle shows none.
 * - Processing: agent glow class + pulse (.animate-pulse-glow, disabled under
 *   prefers-reduced-motion in globals.css); HITL: rose border + glow-rose.
 * - Output row (border-top, h-8) renders ONLY on completion with a preview.
 */
export default function AgentCard({ agent, className }: { agent: AgentState; className?: string }) {
  const isProcessing = agent.status === 'processing';
  const isHitl = agent.status === 'hitl';
  const isCompleted = agent.status === 'completed';

  return (
    <div
      className={cn(
        'relative flex w-40 flex-col rounded-xl border bg-[#1E293B] p-3',
        isHitl ? 'border-[#F43F5E] glow-rose' : 'border-[#283147]',
        isProcessing && cn(agent.glowClass, 'animate-pulse-glow'),
        isCompleted && agent.glowClass,
        className
      )}
    >
      {/* Number badge */}
      <div
        className="absolute -top-3 -left-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ring-2 ring-[#0F1729]"
        style={{ backgroundColor: agent.color }}
      >
        {agent.id}
      </div>

      {/* Status icon (top-right) */}
      <div className="absolute right-2 top-2">
        {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-[#94A3B8]" />}
        {isCompleted && <Check className="h-4 w-4" style={{ color: '#22C55E' }} />}
        {agent.status === 'error' && <AlertTriangle className="h-4 w-4" style={{ color: '#F87171' }} />}
        {isHitl && <Hand className="h-4 w-4" style={{ color: '#F43F5E' }} />}
      </div>

      {/* Bot icon */}
      <div className="mt-2 flex justify-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ backgroundColor: agent.color + '33' }}
        >
          <Bot className="h-6 w-6" style={{ color: agent.color }} />
        </div>
      </div>

      {/* Name (compact) */}
      <div className="mt-2 text-center text-sm font-bold text-white">{agent.name}</div>

      {/* Hover tooltip — description appears on mouseover */}
      <div className="group/tooltip relative">
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-[#334155] bg-[#0F1729] px-3 py-2 text-center text-xs leading-relaxed text-[#CBD5E1] opacity-0 shadow-xl transition-opacity duration-200 group-hover/tooltip:opacity-100">
          {agent.description}
          <div className="absolute top-full left-1/2 -mt-px -translate-x-1/2 border-4 border-transparent border-t-[#0F1729]" />
        </div>
      </div>

      {/* Output row — only once the agent completed with a preview */}
      {isCompleted && agent.output?.preview && (
        <div className="mt-2 flex h-8 items-center justify-center border-t border-[#283147] px-1 text-[10px]">
          <span className="max-w-full truncate text-[#E2E8F0]">{agent.output.preview}</span>
        </div>
      )}
    </div>
  );
}
