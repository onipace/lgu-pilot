export type ResponseMode = 'brief' | 'standard' | 'detailed';

export const RESPONSE_MODE_CONFIG: Record<ResponseMode, {
  label: string;
  wordLimit: number;
  citationCount: number;
  citationLimit: number | null; // null = no upper cap
  maxTokens: number;
}> = {
  brief:    { label: 'Brief',    wordLimit: 150, citationCount: 3, citationLimit: 3,    maxTokens: 400 },
  standard: { label: 'Standard', wordLimit: 300, citationCount: 4, citationLimit: 4,    maxTokens: 600 },
  detailed: { label: 'Detailed', wordLimit: 500, citationCount: 5, citationLimit: null, maxTokens: 1000 },
};

// Prompt suffix appended to the system prompt
export function getResponseModeSuffix(mode: ResponseMode): string {
  const cfg = RESPONSE_MODE_CONFIG[mode];
  const citationRule = cfg.citationLimit
    ? `Include exactly ${cfg.citationLimit} legal citations from the most relevant provisions in the context above. Do not include fewer than ${cfg.citationLimit} or more than ${cfg.citationLimit}. Each citation must reference a distinct legal provision.`
    : `Include at least ${cfg.citationCount} legal citations from the most relevant provisions in the context above. Include more if highly relevant to the question.`;
  return `\n\nRESPONSE FORMAT INSTRUCTION:
- RESPONSE LENGTH: Write a thorough response of approximately ${cfg.wordLimit} words. Fully utilize this word allowance — provide complete legal analysis, explain the reasoning, and include practical implications. Do not truncate or be overly brief.
- ${citationRule}
- Prioritize the most important and directly applicable citations first.`;
}
