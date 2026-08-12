import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import type { DocumentRecord } from "../../src/types";
import { tokenize } from "../build-index";

const ORDINANCES_DIR = path.resolve(
  "c:\\Users\\Emil V. Capino\\DATA\\Claude\\Obsidian\\wiki\\ordinances"
);

interface OrdinanceFrontmatter {
  id: string;
  ordinance_number: string;
  series_year: number;
  type: string;
  date_enacted: string;
  title: string;
  title_filipino: string;
  topics: string[];
  status: string;
  source_pdf: string;
  authors: string[];
  related_ordinances: string[];
  related_opinions: string[];
  ra7160_sections: number[];
  amends: string[];
  repeals: string[];
  approved_by: string;
  presiding_officer: string;
}

export function parseOrdinances(): { records: DocumentRecord[]; fullTexts: Map<string, string> } {
  const files = fs.readdirSync(ORDINANCES_DIR).filter((f) => f.endsWith(".md"));
  const records: DocumentRecord[] = [];
  const fullTexts = new Map<string, string>();
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(ORDINANCES_DIR, file);
    const raw = fs.readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);
    const fm = data as Partial<OrdinanceFrontmatter>;

    // Skip files without a proper id
    if (!fm.id) {
      skipped++;
      continue;
    }

    const id = `ord-${fm.id}`;
    const title = fm.title || `Ordinance ${fm.ordinance_number || file}`;
    const body = content.trim();

    // Skip stubs with no real content
    const isStub =
      body.includes("run PDF-to-image pipeline to extract full content") ||
      (body.length < 200 && body.includes("See source PDF"));

    const fullText = body;
    const snippet = body.substring(0, 300) + (body.length > 300 ? "..." : "");

    const searchableText = [
      title,
      fm.title_filipino || "",
      ...(fm.topics || []),
      ...(fm.authors || []),
      fm.approved_by || "",
      body,
    ].join(" ");

    const terms = tokenize(searchableText);

    records.push({
      id,
      doc_type: "ordinance",
      title,
      ordinance_number: fm.ordinance_number,
      series_year: fm.series_year,
      ordinance_type: fm.type,
      topics: fm.topics || [],
      date_enacted: fm.date_enacted ? String(fm.date_enacted) : undefined,
      authors: fm.authors || [],
      ra7160_sections: fm.ra7160_sections || [],
      snippet: isStub ? `[Stub - PDF extraction pending] ${title}` : snippet,
      terms,
    });

    fullTexts.set(id, fullText);
  }

  console.log(`  Parsed ${records.length} ordinances (${skipped} skipped without ID)`);
  return { records, fullTexts };
}
