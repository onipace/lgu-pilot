// src/types/agentic.ts
// Sprint 1 shared foundation — module-neutral types for the agentic UI kit
// (agent-pipeline.tsx / agent-card.tsx / activity-feed.tsx).
// Module-specific narrowings live in src/types/likha.ts (Sprint 2) and
// src/types/linaw.ts (Sprint 5). No domain entities here.

export type AgenticModuleName = 'likha' | 'linaw';

export type AgentStatus = 'idle' | 'processing' | 'completed' | 'error' | 'hitl';
export type ActivityType = 'success' | 'warning' | 'error' | 'hitl';
export type ActivityStatus = 'pending' | 'confirmed' | 'editing' | 'rejected';
export type HitlSuggestedAction = 'confirm' | 'reject' | 'edit';
export type HitlFieldType = 'text' | 'number' | 'select' | 'multiselect';

/** Base output every agent emits. Modules extend it with domain fields. */
export interface AgentOutputBase {
  /** Short preview line rendered in the agent card's h-8 output section on completion. */
  preview?: string;
  success?: boolean;
  hitlRequired?: boolean;
  exceptions?: string[];
  confidence?: number;
  [key: string]: unknown;
}

/** One pipeline agent card's state. Generic over module (M) and output shape (O). */
export interface AgentState<
  M extends AgenticModuleName = AgenticModuleName,
  O extends AgentOutputBase = AgentOutputBase,
> {
  id: number;
  name: string;
  module: M;
  description: string;
  status: AgentStatus;
  /** Agent hex color, e.g. '#F59E0B' (badge + bot icon tint). */
  color: string;
  /** Glow utility class from globals.css, e.g. 'glow-amber'. */
  glowClass: string;
  output?: O;
}

/** One activity-feed card. */
export interface ActivityItem<O extends AgentOutputBase = AgentOutputBase> {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  details: string;
  timestamp: string;
  data?: O;
  userId?: string;
  reason?: string;
}

/** One editable field inside a HITL inline-edit form. */
export interface HitlFieldSpec {
  type: HitlFieldType;
  label: string;
  value: unknown;
}

/** A paused-pipeline human decision request. `gate` stays string here; modules narrow it. */
export interface HitlItem<
  M extends AgenticModuleName = AgenticModuleName,
  O extends AgentOutputBase = AgentOutputBase,
> {
  id: string;
  activityId: string;
  agentId: number;
  module: M;
  gate: string;
  fieldSchema: Record<string, HitlFieldSpec>;
  suggestedAction: HitlSuggestedAction;
  context: O;
}

/** Row shape of the shared `agent_decisions` audit table (module-scoped by the module column). */
export interface AgentDecisionRecord {
  id: string;
  module: AgenticModuleName;
  pipelineId: string;
  agentId: number;
  agentName: string;
  action: 'start' | 'complete' | 'hitl' | 'confirm' | 'reject' | 'error';
  inputSnapshot?: string;
  outputSnapshot?: string;
  confidence?: number;
  userId?: string;
  reason?: string;
  createdAt: string;
}
