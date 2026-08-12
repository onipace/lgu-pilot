import * as fs from "fs";
import * as path from "path";
import type { DocumentRecord } from "../../src/types";
import { tokenize } from "../build-index";

const SECTIONS_JSON_PATH = path.resolve(
  "c:\\Users\\Emil V. Capino\\DATA\\Claude\\Code\\Pitogo RA7160 Assistant\\RA7160-LRAG-Assistant\\reference\\ra7160\\sections.json"
);

interface RawSection {
  section_number: string;
  title: string;
  full_text: string;
  book: string;
  chapter: string;
}

export function parseRA7160(): { records: DocumentRecord[]; fullTexts: Map<string, string> } {
  const raw = JSON.parse(fs.readFileSync(SECTIONS_JSON_PATH, "utf-8")) as RawSection[];
  const records: DocumentRecord[] = [];
  const fullTexts = new Map<string, string>();

  for (const section of raw) {
    const id = `ra7160-sec-${section.section_number}`;
    const fullText = section.full_text;
    const snippet = fullText.substring(0, 300) + (fullText.length > 300 ? "..." : "");
    const terms = tokenize(
      `${section.title} ${section.book} ${section.chapter} ${fullText}`
    );

    records.push({
      id,
      doc_type: "ra7160",
      title: `Section ${section.section_number} - ${section.title}`,
      section_number: section.section_number,
      book: section.book,
      chapter: section.chapter,
      snippet,
      terms,
    });

    fullTexts.set(id, fullText);
  }

  console.log(`  Parsed ${records.length} R.A. 7160 sections`);
  return { records, fullTexts };
}
