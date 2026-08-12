import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import type { DocumentRecord } from "../../src/types";
import { tokenize } from "../build-index";

const LEGAL_OPINIONS_DIR = path.resolve(
  "c:\\Users\\Emil V. Capino\\DATA\\Claude\\Obsidian\\wiki\\legal-opinions"
);

interface LegalOpinionFrontmatter {
  id: string;
  opinion_number: string;
  series_year: number;
  type: string;
  date_issued: string;
  title: string;
  question: string;
  topics: string[];
  status: string;
  key_laws_cited: string[];
  requesting_party: string;
}

export function parseLegalOpinions(): { records: DocumentRecord[]; fullTexts: Map<string, string> } {
  if (!fs.existsSync(LEGAL_OPINIONS_DIR)) {
    console.warn(`  WARN: Legal opinions directory not found: ${LEGAL_OPINIONS_DIR}`);
    return { records: [], fullTexts: new Map() };
  }

  const files = fs
    .readdirSync(LEGAL_OPINIONS_DIR)
    .filter((f) => f.endsWith(".md") && f.startsWith("LO-"));

  const records: DocumentRecord[] = [];
  const fullTexts = new Map<string, string>();
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(LEGAL_OPINIONS_DIR, file);
    const raw = fs.readFileSync(filePath, "utf-8");

    let data: Partial<LegalOpinionFrontmatter>;
    let content: string;

    try {
      const parsed = matter(raw);
      data = parsed.data as Partial<LegalOpinionFrontmatter>;
      content = parsed.content;
    } catch {
      skipped++;
      continue;
    }

    if (!data.id) {
      skipped++;
      continue;
    }

    const id = `lo-${data.id.toLowerCase()}`;
    const opinionNum = data.opinion_number || "???";
    const year = data.series_year || 0;
    const titleStr = data.title && data.title !== data.id
      ? data.title
      : (data.question && data.question !== data.id ? data.question : "DILG Legal Opinion");

    const title = `DILG Legal Opinion No. ${opinionNum}, S. ${year} - ${titleStr}`;

    const body = content.trim();
    // Use Full Opinion Text section if present, else whole body
    const fullOpinionMatch = body.match(/##\s+Full Opinion Text\s*\n([\s\S]*?)(?=##|$)/);
    const fullText = fullOpinionMatch ? fullOpinionMatch[1].trim() : body;

    const snippet = fullText.substring(0, 300) + (fullText.length > 300 ? "..." : "");

    // Build searchable text from all meaningful fields
    const searchableText = [
      title,
      titleStr,
      data.question || "",
      ...(data.topics || []),
      ...(data.key_laws_cited || []),
      fullText,
    ].join(" ");

    const terms = tokenize(searchableText);

    records.push({
      id,
      doc_type: "dilg_opinion",
      title,
      series_year: year,
      topics: data.topics || [],
      date_enacted: data.date_issued || undefined,
      snippet,
      terms,
    } as DocumentRecord);

    fullTexts.set(id, fullText || body);
  }

  console.log(`  Parsed ${records.length} DILG legal opinions (${skipped} skipped)`);
  return { records, fullTexts };
}
