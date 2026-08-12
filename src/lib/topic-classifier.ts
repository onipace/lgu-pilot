const TOPIC_KEYWORDS: Record<string, string[]> = {
  taxation: [
    "tax", "amilyar", "revenue", "fee", "levy", "buwis", "business permit",
    "tax ordinance", "real property", "local tax", "tariff",
  ],
  permits: [
    "permit", "license", "clearance", "lisensya", "building", "gusali",
    "mayor's permit", "business license", "zoning", "occupancy",
  ],
  sanggunian: [
    "sanggunian", "resolution", "ordinance", "session", "kagawad",
    "vice mayor", "bayan", "council", "legislative", "municipality",
  ],
  "civil-registry": [
    "birth", "death", "marriage", "civil", "kapanganakan", "kasal",
    "certificate", "civil registry", "PSA", "registered",
  ],
  ra7160: [
    "section", "republic act", "local government code", "r.a. 7160",
    "ra 7160", "lgc", "implementing rules", "irr",
  ],
  barangay: [
    "barangay", "brgy", "baryo", "barangay clearance", "punong barangay",
    "barangay captain", "barangay hall",
  ],
  appropriation: [
    "budget", "appropriation", "fund", "allocation", "annual budget",
    "supplemental", "idf", "general fund",
  ],
  welfare: [
    "health", "environment", "solid waste", "sanitation", "education",
    "livelihood", "social", "welfare", "ecological",
  ],
  penalties: [
    "penalty", "fine", "violation", "ultra vires", "sanctions",
    "imprisonment", "revoke", "suspend", "illegal",
  ],
  services: [
    "service", "office", "municipal hall", "office hours", "contact",
    "procedure", "requirements", "steps", "process",
  ],
};

export function classifyTopics(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(topic);
    }
  }

  return matched;
}
