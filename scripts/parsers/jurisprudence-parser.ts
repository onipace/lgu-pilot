import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import type { DocumentRecord } from "../../src/types";
import { tokenize } from "../build-index";

const JURISPRUDENCE_DIR = path.resolve(
  "c:\\Users\\Emil V. Capino\\DATA\\Claude\\Obsidian\\wiki\\jurisprudence"
);

interface JurisprudenceFrontmatter {
  id: string;
  case_number: string;
  type: string;
  decision_date: string;
  petitioner: string;
  respondent: string;
  title: string;
  topics: string[];
  status: string;
  ra7160_sections: number[];
  source: string;
  content_length: number;
}

export function parseJurisprudence(): { records: DocumentRecord[]; fullTexts: Map<string, string> } {
  if (!fs.existsSync(JURISPRUDENCE_DIR)) {
    console.warn(`  WARN: Jurisprudence directory not found: ${JURISPRUDENCE_DIR}`);
    return { records: [], fullTexts: new Map() };
  }

  const files = fs
    .readdirSync(JURISPRUDENCE_DIR)
    .filter((f) => f.endsWith(".md") && f.startsWith("SC-"));

  const records: DocumentRecord[] = [];
  const fullTexts = new Map<string, string>();
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(JURISPRUDENCE_DIR, file);
    const raw = fs.readFileSync(filePath, "utf-8");

    let data: Partial<JurisprudenceFrontmatter>;
    let content: string;

    try {
      const parsed = matter(raw);
      data = parsed.data as Partial<JurisprudenceFrontmatter>;
      content = parsed.content;
    } catch {
      skipped++;
      continue;
    }

    if (!data.id || !data.case_number) {
      skipped++;
      continue;
    }

    const id = `sc-${data.id.toLowerCase()}`;
    const caseNum = data.case_number;
    const caseTitle = data.title || `${data.petitioner || "?"} v. ${data.respondent || "?"}`;
    const decisionDateStr = data.decision_date ? String(data.decision_date) : "";
    const year = decisionDateStr ? decisionDateStr.substring(0, 4) : "";

    const title = `${caseNum} - ${caseTitle}${year ? ` (${year})` : ""}`;

    const body = content.trim();
    const snippet = body.substring(0, 300) + (body.length > 300 ? "..." : "");

    const searchableText = [
      title,
      caseTitle,
      data.petitioner || "",
      data.respondent || "",
      ...(data.topics || []),
      body,
    ].join(" ");

    const terms = tokenize(searchableText);

    records.push({
      id,
      doc_type: "jurisprudence",
      title,
      topics: data.topics || [],
      date_enacted: decisionDateStr || undefined,
      ra7160_sections: data.ra7160_sections || [],
      snippet,
      terms,
    } as DocumentRecord);

    fullTexts.set(id, body);
  }

  console.log(`  Parsed ${records.length} SC jurisprudence decisions (${skipped} skipped)`);
  return { records, fullTexts };
}
