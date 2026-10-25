import { RESPONSE_MODE_CONFIG, getEffectiveMaxTokens } from "../src/lib/ai/response-mode";

console.log("=== CR-002 Derived Budgets ===\n");

for (const mode of ["brief", "standard", "detailed"] as const) {
  const cfg = RESPONSE_MODE_CONFIG[mode];
  console.log(`${mode.toUpperCase()} — word cap: ${cfg.wordLimit} | citations: ${cfg.citationLimit ?? `${cfg.citationCount}+`}`);
  console.log(`  maxTokens (legacy safety): ${cfg.maxTokens}`);
  for (const model of [
    "qwen/qwen3.7-plus",
    "qwen/qwen3.8-flash",
    "qwen/qwen3-235b-a22b",
    "qwen/qwen-plus",
    "openai/gpt-4o-mini",
  ]) {
    const tokens = getEffectiveMaxTokens(mode, model);
    console.log(`  ${model.padEnd(28)} → ${tokens} tok`);
  }
  console.log("");
}
