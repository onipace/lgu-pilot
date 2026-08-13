import { getSearchIndex } from "@/lib/ai/rag";
import type { DocType, SearchResult } from "@/types";

// ── Types ────────────────────────────────────────────────────────────

export interface CitationReference {
  raw: string;
  sectionNumber: string;
  subSection: string;
  docType: DocType;
  position: number;
}

export interface CitationValidation {
  reference: CitationReference;
  verified: boolean;
  source: "kb" | "llm";
  relevanceRating: "high" | "medium" | "low";
  docId: string | null;
  title: string | null;
  snippet: string | null;
  confidence: "high" | "medium" | "low";
}

export interface CitationValidationResult {
  citations: CitationValidation[];
  kb: CitationValidation[];
  llm: CitationValidation[];
  verified: CitationValidation[];
  unverified: CitationValidation[];
  summary: {
    total: number;
    kbCount: number;
    llmCount: number;
    verifiedCount: number;
    unverifiedCount: number;
  };
}

// ── Roman numeral converter ──────────────────────────────────────────

const ROMAN_MAP: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9,
  x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16,
  xvii: 17, xviii: 18, xix: 19, xx: 20, xxi: 21, xxii: 22,
  xxiii: 23, xxiv: 24, xxv: 25, xxvi: 26, xxvii: 27, xxviii: 28,
  xxix: 29, xxx: 30, xxxi: 31, xxxii: 32, xxxiii: 33, xxxiv: 34,
  xxxv: 35, xxxvi: 36, xxxvii: 37, xxxviii: 38, xxxix: 39,
};

function romanToInt(roman: string): number | null {
  return ROMAN_MAP[roman.toLowerCase()] ?? null;
}

// ── Citation extraction ───────────────────────────────────────────────

const RA7160_PATTERN = /(?:Section|Sec\.?)\s+(\d{1,3}[A-Za-z]?)\s*(\([^)]+\))*/gi;
const ORDINANCE_PATTERN = /(?:(?:Municipal\s+)?Ordinance|(?:MO|AO))\s+No\.?\s*(\d+[-\d]*),?\s*S\.?\s*(\d{4})/gi;
const IRR_PATTERN = /IRR\s+(?:of\s+R\.?A\.?\s*(?:No\.?\s*)?7160[,;]?\s*)?Rule\s+([IVXLCDM]+)/gi;
const DILG_OPINION_PATTERN = /DILG\s+(?:LO|Legal\s+Opinion)\s+No\.?\s*(\d+),?\s*S\.?\s*(\d{4})/gi;
const JURISPRUDENCE_PATTERN = /G\.?\s*R\.?\s+No\.?\s*(\d{4,6}(?:-\d+)?)/gi;

export function extractCitations(text: string): CitationReference[] {
  const refs: CitationReference[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  // R.A. 7160 sections
  RA7160_PATTERN.lastIndex = 0;
  while ((match = RA7160_PATTERN.exec(text)) !== null) {
    const sectionNum = match[1].trim();
    const key = `ra7160-${sectionNum}`;
    if (seen.has(key)) continue;
    // Skip very low section numbers that are likely general references, not R.A. 7160
    // (e.g., "Section 1" in a draft ordinance body vs. "Section 1 of R.A. 7160")
    const fullMatch = match[0];
    const isRA7160Context =
      text.substring(Math.max(0, match.index - 50), match.index).toLowerCase().includes("r.a.") ||
      text.substring(match.index, Math.min(text.length, match.index + fullMatch.length + 50)).toLowerCase().includes("r.a.") ||
      text.substring(match.index, Math.min(text.length, match.index + fullMatch.length + 50)).toLowerCase().includes("7160") ||
      sectionNum.length >= 2; // Sections 10+ are almost certainly R.A. 7160 references
    if (!isRA7160Context && parseInt(sectionNum) < 10) continue;

    seen.add(key);
    const subSection = match[2] || "";
    refs.push({
      raw: fullMatch,
      sectionNumber: sectionNum,
      subSection,
      docType: "ra7160",
      position: match.index,
    });
  }

  // Ordinances
  ORDINANCE_PATTERN.lastIndex = 0;
  while ((match = ORDINANCE_PATTERN.exec(text)) !== null) {
    const ordNum = match[1].trim();
    const year = match[2].trim();
    const key = `ord-${ordNum}-${year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({
      raw: match[0],
      sectionNumber: `${ordNum}/${year}`,
      subSection: "",
      docType: "ordinance",
      position: match.index,
    });
  }

  // IRR Rules
  IRR_PATTERN.lastIndex = 0;
  while ((match = IRR_PATTERN.exec(text)) !== null) {
    const roman = match[1].trim();
    const key = `irr-${roman.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({
      raw: match[0],
      sectionNumber: roman,
      subSection: "",
      docType: "irr",
      position: match.index,
    });
  }

  // DILG Legal Opinions
  DILG_OPINION_PATTERN.lastIndex = 0;
  while ((match = DILG_OPINION_PATTERN.exec(text)) !== null) {
    const opinionNum = match[1].trim();
    const year = match[2].trim();
    const key = `dilg-${opinionNum}-${year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({
      raw: match[0],
      sectionNumber: opinionNum,
      subSection: year,
      docType: "dilg_opinion",
      position: match.index,
    });
  }

  // SC Jurisprudence
  JURISPRUDENCE_PATTERN.lastIndex = 0;
  while ((match = JURISPRUDENCE_PATTERN.exec(text)) !== null) {
    const grNumber = match[1].trim();
    const key = `sc-${grNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({
      raw: match[0],
      sectionNumber: grNumber,
      subSection: "",
      docType: "jurisprudence",
      position: match.index,
    });
  }

  return refs;
}

// ── Citation validation ───────────────────────────────────────────────

function validateRA7160(
  sectionNumber: string,
  subSection: string
): { docId: string | null; title: string | null; snippet: string | null; confidence: "high" | "medium" | "low" } {
  const index = getSearchIndex();
  const doc = index.documents.find(
    (d) => d.doc_type === "ra7160" && d.section_number === sectionNumber
  );

  if (!doc) {
    return { docId: null, title: null, snippet: null, confidence: "low" };
  }

  // Base section verified
  const docId = doc.id;
  const title = doc.title;
  const snippet = doc.snippet;

  // If there's a sub-section reference (e.g., "(a)(3)(iii)"), we can only
  // verify the base section exists; sub-sections are within the full text.
  if (subSection && subSection.length > 0) {
    return { docId, title, snippet, confidence: "medium" };
  }

  return { docId, title, snippet, confidence: "high" };
}

function validateOrdinance(
  ordNum: string,
  year: string
): { docId: string | null; title: string | null; snippet: string | null; confidence: "high" | "medium" | "low" } {
  const index = getSearchIndex();
  const baseNum = ordNum.replace(/^0+/, "");

  const match = index.documents.find((d) => {
    if (d.doc_type !== "ordinance") return false;
    if (d.series_year !== parseInt(year)) return false;
    const docOrdNum = (d.ordinance_number || "").replace(/^0+/, "");
    return docOrdNum === baseNum;
  });

  if (!match) {
    return { docId: null, title: null, snippet: null, confidence: "low" };
  }

  return { docId: match.id, title: match.title, snippet: match.snippet, confidence: "high" };
}

function validateIRR(
  roman: string
): { docId: string | null; title: string | null; snippet: string | null; confidence: "high" | "medium" | "low" } {
  const ruleNum = romanToInt(roman);
  if (ruleNum === null) {
    return { docId: null, title: null, snippet: null, confidence: "low" };
  }

  const index = getSearchIndex();
  const doc = index.documents.find(
    (d) => d.doc_type === "irr" && d.rule_number === ruleNum
  );

  if (!doc) {
    return { docId: null, title: null, snippet: null, confidence: "low" };
  }

  return { docId: doc.id, title: doc.title, snippet: doc.snippet, confidence: "high" };
}

function validateDILGOpinion(
  opinionNum: string,
  year: string
): { docId: string | null; title: string | null; snippet: string | null; confidence: "high" | "medium" | "low" } {
  const index = getSearchIndex();
  const yearNum = parseInt(year);
  const baseNum = opinionNum.replace(/^0+/, "");

  const match = index.documents.find((d) => {
    if (d.doc_type !== "dilg_opinion") return false;
    if (d.series_year !== yearNum) return false;
    // Title format: "DILG Legal Opinion No. 022, S. 2018 - ..."
    const titleMatch = d.title.match(/No\.?\s*(\d+)/);
    if (!titleMatch) return false;
    return titleMatch[1].replace(/^0+/, "") === baseNum;
  });

  if (!match) {
    return { docId: null, title: null, snippet: null, confidence: "low" };
  }

  return { docId: match.id, title: match.title, snippet: match.snippet, confidence: "high" };
}

function validateJurisprudence(
  grNumber: string
): { docId: string | null; title: string | null; snippet: string | null; confidence: "high" | "medium" | "low" } {
  const index = getSearchIndex();
  const grRegex = new RegExp(`G\\.?R\\.?\\s*No\\.?\\s*${grNumber}\\b`, "i");

  const match = index.documents.find((d) => {
    if (d.doc_type !== "jurisprudence") return false;
    // Title format: "G.R. No. 182969 - Case Name (Year)"
    return grRegex.test(d.title);
  });

  if (!match) {
    return { docId: null, title: null, snippet: null, confidence: "low" };
  }

  return { docId: match.id, title: match.title, snippet: match.snippet, confidence: "high" };
}

// ── LLM citation relevance rating ─────────────────────────────────────

function rateLLMCitation(ref: CitationReference, ragContext?: string): "high" | "medium" | "low" {
  // Extract the key identifier from the citation
  let searchKey = "";
  switch (ref.docType) {
    case "jurisprudence":
      searchKey = ref.sectionNumber;
      break;
    case "dilg_opinion":
      searchKey = ref.sectionNumber;
      break;
    case "ordinance": {
      const parts = ref.sectionNumber.split("/");
      searchKey = parts[0] || "";
      break;
    }
    case "ra7160":
      searchKey = ref.sectionNumber;
      break;
    case "irr":
      searchKey = ref.sectionNumber;
      break;
    default:
      return "low";
  }

  if (!searchKey || !ragContext) return "medium";

  // Check if the citation's key identifier appears in the RAG context
  const contextLower = ragContext.toLowerCase();
  const keyLower = searchKey.toLowerCase();

  if (contextLower.includes(keyLower)) {
    return "high";
  }

  return "medium";
}

function validateCitation(ref: CitationReference, ragContext?: string): CitationValidation {
  let result: { docId: string | null; title: string | null; snippet: string | null; confidence: "high" | "medium" | "low" };

  switch (ref.docType) {
    case "ra7160":
      result = validateRA7160(ref.sectionNumber, ref.subSection);
      break;
    case "ordinance": {
      const parts = ref.sectionNumber.split("/");
      result = validateOrdinance(parts[0], parts[1] || "");
      break;
    }
    case "irr":
      result = validateIRR(ref.sectionNumber);
      break;
    case "dilg_opinion":
      result = validateDILGOpinion(ref.sectionNumber, ref.subSection);
      break;
    case "jurisprudence":
      result = validateJurisprudence(ref.sectionNumber);
      break;
    default:
      result = { docId: null, title: null, snippet: null, confidence: "low" };
  }

  const isInKB = result.docId !== null;
  const source: "kb" | "llm" = isInKB ? "kb" : "llm";
  const relevanceRating = isInKB ? "high" : rateLLMCitation(ref, ragContext);

  return {
    reference: ref,
    verified: isInKB,
    source,
    relevanceRating,
    docId: result.docId,
    title: result.title,
    snippet: result.snippet,
    confidence: result.confidence,
  };
}

export function validateAllCitations(text: string, ragContext?: string): CitationValidationResult {
  const refs = extractCitations(text);
  const citations = refs.map(ref => validateCitation(ref, ragContext));
  const kb = citations.filter((c) => c.source === "kb");
  const llm = citations.filter((c) => c.source === "llm");
  const verified = citations.filter((c) => c.verified);
  const unverified = citations.filter((c) => !c.verified);

  return {
    citations,
    kb,
    llm,
    verified,
    unverified,
    summary: {
      total: citations.length,
      kbCount: kb.length,
      llmCount: llm.length,
      verifiedCount: verified.length,
      unverifiedCount: unverified.length,
    },
  };
}

// ── Allow-list builder for prompt injection ───────────────────────────

export function buildCitationAllowList(searchResults: SearchResult[]): string {
  if (searchResults.length === 0) return "";

  const lines = searchResults.map((r) => {
    const label =
      r.doc_type === "ra7160"
        ? `Section ${r.section_number || r.id.replace("ra7160-sec-", "")}`
        : r.doc_type === "ordinance"
          ? `MO No. ${r.ordinance_number || "?"}, S. ${r.id.match(/S(\d{4})/)?.[1] || "?"}`
          : r.doc_type === "irr"
            ? `IRR Rule ${r.title.match(/Rule\s+([IVXLCDM]+)/i)?.[1] || "?"}`
            : r.title;
    return `- ${label} — ${r.title}`;
  });

  return `ALLOWED CITATIONS (you may ONLY cite these provisions):\n${lines.join("\n")}`;
}
