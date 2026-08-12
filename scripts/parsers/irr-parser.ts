import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import type { DocumentRecord } from "../../src/types";
import { tokenize } from "../build-index";

const IRR_DIR = path.resolve(
  "c:\\Users\\Emil V. Capino\\DATA\\Claude\\Obsidian\\wiki\\irr-ra7160"
);

interface IRRFrontmatter {
  id: string;
  rule_number: number;
  rule_roman: string;
  title: string;
  type: string;
  total_articles: number;
  topics: string[];
  status: string;
  source: string;
}

export function parseIRR(): { records: DocumentRecord[]; fullTexts: Map<string, string> } {
  const files = fs
    .readdirSync(IRR_DIR)
    .filter((f) => f.endsWith(".md") && f.startsWith("irr-rule-"));
  const records: DocumentRecord[] = [];
  const fullTexts = new Map<string, string>();

  for (const file of files) {
    const filePath = path.join(IRR_DIR, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);
    const fm = data as Partial<IRRFrontmatter>;

    if (!fm.id) continue;

    const id = `irr-${fm.id.toLowerCase()}`;
    const title = fm.title
      ? `IRR Rule ${fm.rule_roman || fm.rule_number} - ${fm.title}`
      : `IRR Rule ${fm.rule_roman || fm.rule_number}`;
    const body = content.trim();
    const fullText = body;
    const snippet = body.substring(0, 300) + (body.length > 300 ? "..." : "");

    const searchableText = [
      title,
      ...(fm.topics || []),
      body,
    ].join(" ");

    const terms = tokenize(searchableText);

    records.push({
      id,
      doc_type: "irr",
      title,
      rule_number: fm.rule_number,
      topics: fm.topics || [],
      snippet,
      terms,
    });

    fullTexts.set(id, fullText);
  }

  console.log(`  Parsed ${records.length} IRR rules`);
  return { records, fullTexts };
}
