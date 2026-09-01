'use client';

import { Fragment } from 'react';
import { Brain, Database, ArrowRight, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import AgentCard from '@/components/agent-card';
import type { AgentState } from '@/types/agentic';

interface AgentPipelineProps {
  /** Rendered in array order; numbering is the card's job (agent.id). */
  agents: AgentState[];
  /** Pipeline run active → input bookend glows cyan + pulses. */
  isProcessing: boolean;
  /** All work done → output bookend glows green. */
  pipelineComplete?: boolean;
  className?: string;
}

/** Arrow between pipeline elements; optionally carries the rose HITL pause marker. */
function FlowArrow({ hitl }: { hitl?: boolean }) {
  return (
    <span className="relative inline-flex items-center self-center md:rotate-0 -rotate-90 md:my-0 my-1">
      <ArrowRight className="h-4 w-4 text-[#94A3B8]" />
      {hitl && <Hand className="absolute -top-2 right-0 h-3.5 w-3.5 text-[#F43F5E]" />}
    </span>
  );
}

/**
 * AgentPipeline — shared horizontal pipeline visualization:
 * Brain input bookend → N AgentCards → Database output bookend.
 * Purely presentational: everything derives from props (no state, no timers,
 * no callbacks, no module branching).
 */
export default function AgentPipeline({ agents, isProcessing, pipelineComplete, className }: AgentPipelineProps) {
  const lastAgent = agents[agents.length - 1];

  return (
    <div className={cn('flex flex-col md:flex-row md:flex-nowrap items-stretch gap-3 md:gap-4', className)}>
      {/* Input bookend — Brain */}
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center self-center rounded-2xl border border-[#283147] bg-[#1E293B]',
          isProcessing && 'glow-cyan animate-pulse-glow'
        )}
      >
        <Brain className="h-7 w-7" style={{ color: '#22D3EE' }} />
      </div>

      {/* Agent cards, each preceded by an arrow; the arrow after a HITL agent gets the rose marker */}
      {agents.map((agent, i) => (
        <Fragment key={agent.id}>
          <FlowArrow hitl={i > 0 && agents[i - 1].status === 'hitl'} />
          <AgentCard agent={agent} className="self-center md:self-stretch" />
        </Fragment>
      ))}

      {/* Arrow into the output bookend (carries the marker if the last agent is paused on HITL) */}
      <FlowArrow hitl={lastAgent?.status === 'hitl'} />

      {/* Output bookend — Database */}
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center self-center rounded-2xl border border-[#283147] bg-[#1E293B]',
          pipelineComplete && 'glow-emerald'
        )}
      >
        <Database className="h-7 w-7" style={{ color: pipelineComplete ? '#22C55E' : '#94A3B8' }} />
      </div>
    </div>
  );
}
