import * as fs from "fs";
import * as path from "path";
import { parseRA7160 } from "./parsers/ra7160-parser";
import { parseOrdinances } from "./parsers/ordinance-parser";
import { parseIRR } from "./parsers/irr-parser";
import { parseLegalOpinions } from "./parsers/legal-opinion-parser";
import { parseJurisprudence } from "./parsers/jurisprudence-parser";
import { buildSearchIndex } from "./build-index";

const OUTPUT_DIR = path.resolve(__dirname, "../src/lib/data");
const DOCUMENTS_DIR = path.join(OUTPUT_DIR, "documents");

async function main() {
  console.log("=== eSANGGUNI Content Ingestion Pipeline ===\n");
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });

  console.log("[1/6] Parsing R.A. 7160 sections...");
  const ra7160 = parseRA7160();

  console.log("[2/6] Parsing Pitogo ordinances...");
  const ordinances = parseOrdinances();

  console.log("[3/6] Parsing IRR of R.A. 7160...");
  const irr = parseIRR();

  console.log("[4/6] Parsing DILG Legal Opinions...");
  const opinions = parseLegalOpinions();

  console.log("[5/6] Parsing SC Jurisprudence...");
  const jurisprudence = parseJurisprudence();

  const allRecords = [
    ...ra7160.records, ...ordinances.records, ...irr.records,
    ...opinions.records, ...jurisprudence.records,
  ];

  console.log(`\nTotal documents: ${allRecords.length}`);
  console.log(`  - R.A. 7160:           ${ra7160.records.length}`);
  console.log(`  - Ordinances:          ${ordinances.records.length}`);
  console.log(`  - IRR:                 ${irr.records.length}`);
  console.log(`  - DILG Legal Opinions: ${opinions.records.length}`);
  console.log(`  - SC Jurisprudence:    ${jurisprudence.records.length}`);

  console.log("\n[6/6] Building BM25 search index...");
  const searchIndex = buildSearchIndex(allRecords);
  console.log(`  IDF vocabulary size: ${Object.keys(searchIndex.idf).length} terms`);
  console.log(`  Average document length: ${searchIndex.avgDocLength.toFixed(1)} terms`);

  const indexPath = path.join(OUTPUT_DIR, "search-index.json");
  fs.writeFileSync(indexPath, JSON.stringify(searchIndex, null, 0));
  const indexSizeMB = (fs.statSync(indexPath).size / 1024 / 1024).toFixed(2);
  console.log(`  Index written to: ${indexPath} (${indexSizeMB} MB)`);

  console.log("\nWriting individual document files...");
  const allFullTexts = new Map([
    ...ra7160.fullTexts, ...ordinances.fullTexts, ...irr.fullTexts,
    ...opinions.fullTexts, ...jurisprudence.fullTexts,
  ]);

  let docCount = 0;
  for (const [id, fullText] of allFullTexts) {
    const docPath = path.join(DOCUMENTS_DIR, `${id}.json`);
    fs.writeFileSync(docPath, JSON.stringify({ id, full_text: fullText }));
    docCount++;
  }
  console.log(`  Written ${docCount} document files to: ${DOCUMENTS_DIR}`);

  const totalSizeMB = (getAllFileSizes(DOCUMENTS_DIR) / 1024 / 1024).toFixed(2);
  console.log("\n=== Ingestion Complete ===");
  console.log(`  Total documents: ${allRecords.length}`);
  console.log(`  Index size: ${indexSizeMB} MB`);
  console.log(`  Documents dir size: ${totalSizeMB} MB`);
}

function getAllFileSizes(dir: string): number {
  let total = 0;
  for (const f of fs.readdirSync(dir)) {
    total += fs.statSync(path.join(dir, f)).size;
  }
  return total;
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
