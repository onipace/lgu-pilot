// Core chat/message types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: Date;
  responseTimeMs?: number;
}

export interface Citation {
  section: string;
  title: string;
  text: string;
  relevance: number;
  doc_type?: DocType;
  verified?: boolean;
  source?: "kb" | "llm";
  relevance_rating?: "high" | "medium" | "low";
  confidence?: "high" | "medium" | "low";
  doc_id?: string;
}

// OBRA types
export interface ComplianceRisk {
  severity: "low" | "medium" | "high";
  section: string;
  description: string;
  recommendation: string;
}

export interface ReviewResult {
  overallScore: number;
  risks: ComplianceRisk[];
  structuralIssues: string[];
  missingSections: string[];
  citationWarnings?: CitationWarning[];
}

export interface CitationWarning {
  section: string;
  raw: string;
  verified: boolean;
  confidence: "high" | "medium" | "low";
  correctSection?: string;
  reason: string;
}

export interface DraftDetails {
  title: string;
  subjectMatter: string;
  keyProvisions: string;
  targetArea: string;
}

export type OrdTemplateType = "tax" | "regulatory" | "appropriation" | "general";
export type Module = "ella" | "obra" | "yala";
export type DocType = "ra7160" | "ordinance" | "irr" | "dilg_opinion" | "jurisprudence";

// Logging types
export interface LogMetadata {
  participantName?: string;
  sessionId: string;
}

export interface WorkshopSession {
  id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface ParticipantSession {
  id: string;
  workshop_session_id: string;
  participant_name: string | null;
  ip_address: string | null;
  module: string;
  started_at: string;
  last_active_at: string;
}

export interface InteractionLog {
  id: number;
  participant_session_id: string;
  workshop_session_id: string;
  module: string;
  interaction_type: "chat_message" | "obra_draft" | "obra_review";
  role: "user" | "assistant" | null;
  content: string | null;
  topic_tags: string | null;
  obra_template: string | null;
  obra_compliance_score: number | null;
  obra_draft_length: number | null;
  created_at: string;
}

// Admin stats API response
export interface AdminStats {
  workshopSession: WorkshopSession | null;
  allSessions: WorkshopSession[];
  totals: {
    sessions: number;
    messages: number;
    byModule: Record<string, number>;
  };
  topTopics: Array<{ module: string; topic: string; count: number }>;
  topParticipants: Array<{
    name: string;
    messageCount: number;
    modules: string[];
  }>;
  obraStats: {
    totalDrafts: number;
    avgComplianceScore: number;
    templateBreakdown: Record<string, number>;
  };
  activityTimeline: Array<{ hour: string; count: number }>;
}

// RAG / Search Index types (from eSANGGUNI backend)
export interface DocumentRecord {
  id: string;
  doc_type: DocType;
  title: string;
  section_number?: string;
  ordinance_number?: string;
  series_year?: number;
  ordinance_type?: string;
  book?: string;
  chapter?: string;
  rule_number?: number;
  topics?: string[];
  date_enacted?: string;
  authors?: string[];
  ra7160_sections?: number[];
  snippet: string;
  terms: Record<string, number>;
}

export interface SearchIndex {
  documents: DocumentRecord[];
  idf: Record<string, number>;
  avgDocLength: number;
  totalDocs: number;
}

export interface SearchResult {
  id: string;
  doc_type: DocType;
  title: string;
  section_number?: string;
  ordinance_number?: string;
  snippet: string;
  relevance: number;
}

export interface SanggunianMemberData {
  id: string;
  name: string;
  honorific: string;
  position: string;
  committee: string;
  photo: string;
  backdropColor?: string;
  order: number;
  isExOfficio: boolean;
  exOfficioTitle?: string;
}

// ── Admin & Auth Types ──────────────────────────────────
export interface AdminUserRecord {
  id: string;
  username: string;
  display_name: string | null;
  role: "super_admin" | "lgu_admin";
  lgu_id: string | null;
  province_id: string | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

// ── Knowledge Base Types ──────────────────────────────────
export type KbDocType = "ordinance" | "ra7160" | "irr" | "dilg_opinion" | "jurisprudence" | "policy" | "context";
export type KbDocStatus = "pending" | "indexed" | "error";

export interface KbDocument {
  id: string;
  lgu_id: string;
  doc_type: KbDocType;
  title: string;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  metadata: Record<string, unknown> | null;
  section_number: string | null;
  ordinance_number: string | null;
  series_year: number | null;
  ordinance_type: string | null;
  rule_number: number | null;
  topics: string[] | null;
  status: KbDocStatus;
  error_message: string | null;
  indexed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KbIndexRun {
  id: number;
  lgu_id: string;
  status: "running" | "completed" | "error";
  documents_indexed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  triggered_by: string | null;
}

export interface KbStats {
  total_documents: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_lgu: Array<{ lgu_id: string; count: number }>;
  last_index_run: KbIndexRun | null;
  lightrag: {
    total_documents: number;
    total_entities: number;
    total_relations: number;
    status: string;
  } | null;
}

// ── ECS & Deployment Types ──────────────────────────────
export type LguType = "municipality" | "city" | "component_city" | "huc";
export type LguClass = "1st" | "2nd" | "3rd" | "4th" | "5th" | "6th";
export type DeploymentStatus = "running" | "stopped" | "error" | "building" | "unknown";
export type EcsStatus = "online" | "offline" | "error" | "unknown";

export interface EcsInstance {
  id: string;
  name: string;
  province: string;
  region: string | null;
  public_ip: string;
  ssh_port: number;
  ssh_user: string;
  ssh_key_path: string | null;
  status: EcsStatus;
  last_health_check: string | null;
  metadata: Record<string, unknown> | null;
  notes: string | null;
  deployment_count?: number;
  running_count?: number;
  created_at: string;
  updated_at: string;
}

export interface LguDeployment {
  id: string;
  lgu_id: string;
  lgu_name: string;
  lgu_type: LguType;
  lgu_class: LguClass | null;
  province: string;
  ecs_instance_id: string;
  container_name: string;
  container_port: number;
  image_tag: string;
  status: DeploymentStatus;
  domain: string | null;
  openrouter_api_key: string | null;
  lightrag_service_url: string | null;
  env_vars: Record<string, string> | null;
  last_deployed_at: string | null;
  last_health_check: string | null;
  health_status: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  ecs_instance?: EcsInstance;
}

export interface DeploymentAction {
  action: "deploy" | "start" | "stop" | "restart" | "rebuild" | "destroy";
  commands: string[];
  ssh_host?: string;
  ssh_user?: string;
  ssh_port?: number;
}

export interface EcsHealthCheck {
  ecs_id: string;
  status: string;
  docker_version: string;
  containers_running: number;
  containers_total: number;
  cpu_usage: string;
  memory_usage: string;
  disk_usage: string;
  uptime: string;
  last_check: string;
}
