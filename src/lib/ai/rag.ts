import * as fs from "fs";
import * as path from "path";
import type { SearchIndex, SearchResult, DocType } from "@/types";
import { queryLightRAG, ingestDocument, deleteDocument } from "./lightrag";

// Module-scope cache for warm serverless instances
let cachedIndex: SearchIndex | null = null;

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "must", "ought",
  "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
  "neither", "each", "every", "all", "any", "few", "more", "most",
  "other", "some", "such", "no", "only", "own", "same", "than",
  "too", "very", "just", "because", "as", "until", "while", "of",
  "at", "by", "for", "with", "about", "against", "between", "through",
  "during", "before", "after", "above", "below", "to", "from", "up",
  "down", "in", "out", "on", "off", "over", "under", "again", "further",
  "then", "once", "here", "there", "when", "where", "why", "how",
  "this", "that", "these", "those", "it", "its", "he", "she", "they",
  "them", "his", "her", "their", "what", "which", "who", "whom",
  "ang", "ng", "mga", "sa", "na", "at", "ay", "para", "ito", "rin",
  "din", "naman", "po", "kung", "nang", "dahil", "pero", "kaya",
  "hindi", "wala", "siya", "niya", "kanila", "kami", "tayo", "ako",
  "ikaw", "ka", "mo", "ko", "natin", "namin", "iyon", "doon", "dito",
  "pag", "kapag", "mula", "hanggang", "tungkol", "upang", "bilang",
]);

// BM25 parameters
const K1 = 1.2;
const B = 0.75;

// Minimum normalized relevance score (0-1). Documents below this threshold
// share only common legal terminology and are not meaningfully relevant.
const MIN_RELEVANCE_THRESHOLD = 0.15;

// Maximum total context length in characters to stay within token budgets
const MAX_CONTEXT_CHARS = 4000;

export function getSearchIndex(): SearchIndex {
  if (cachedIndex) return cachedIndex;

  const indexPath = path.join(process.cwd(), "src/lib/data/search-index.json");
  if (!fs.existsSync(indexPath)) {
    throw new Error("Search index not found. Run `npm run ingest` first.");
  }

  cachedIndex = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as SearchIndex;
  return cachedIndex;
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export interface SearchOptions {
  docTypes?: DocType[];
  limit?: number;
}

export function searchDocuments(
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const { docTypes, limit = 8 } = options;
  const index = getSearchIndex();
  const queryTerms = tokenizeQuery(query);

  if (queryTerms.length === 0) return [];

  // Extract section number patterns (e.g., "Section 447", "sec 129")
  const sectionMatch = query.match(/(?:section|sec\.?)\s*(\d+)/i);
  const extractedSectionNum = sectionMatch ? sectionMatch[1] : null;

  // Extract ordinance number patterns (e.g., "MO 01", "ordinance 02-2024")
  const ordMatch = query.match(/(?:mo|ordinance|ord)\s*(?:no\.?\s*)?(\d+)/i);
  const extractedOrdNum = ordMatch ? ordMatch[1] : null;

  const results: { doc: (typeof index.documents)[0]; score: number }[] = [];

  for (const doc of index.documents) {
    // Filter by doc type if specified
    if (docTypes && !docTypes.includes(doc.doc_type)) continue;

    // BM25 score calculation
    const docLength = Object.values(doc.terms).reduce((a, b) => a + b, 0);
    let score = 0;

    for (const term of queryTerms) {
      const tf = doc.terms[term] || 0;
      if (tf === 0) continue;

      const idf = index.idf[term] || 0;
      const tfNorm =
        (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (docLength / index.avgDocLength)));
      score += idf * tfNorm;
    }

    // Boost: exact section number match
    if (extractedSectionNum && doc.section_number === extractedSectionNum) {
      score *= 5;
    }

    // Boost: exact ordinance number match
    if (extractedOrdNum && doc.ordinance_number) {
      const normalizedDocOrd = doc.ordinance_number.replace(/^0+/, "");
      const normalizedQueryOrd = extractedOrdNum.replace(/^0+/, "");
      if (normalizedDocOrd === normalizedQueryOrd) {
        score *= 5;
      }
    }

    // Boost: topic match
    if (doc.topics && doc.topics.length > 0) {
      for (const term of queryTerms) {
        if (doc.topics.some((t) => t.includes(term))) {
          score *= 1.5;
          break;
        }
      }
    }

    if (score > 0) {
      results.push({ doc, score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Normalize scores to 0-1 range
  const maxScore = results.length > 0 ? results[0].score : 1;

  return results
    .slice(0, limit)
    .map((r) => ({
      id: r.doc.id,
      doc_type: r.doc.doc_type,
      title: r.doc.title,
      section_number: r.doc.section_number,
      ordinance_number: r.doc.ordinance_number,
      snippet: r.doc.snippet,
      relevance: Math.min(r.score / maxScore, 1),
    }))
    .filter((r) => r.relevance >= MIN_RELEVANCE_THRESHOLD);
}

export function getDocumentFullText(id: string): string | null {
  const docPath = path.join(process.cwd(), "src/lib/data/documents", `${id}.json`);
  if (!fs.existsSync(docPath)) return null;

  const doc = JSON.parse(fs.readFileSync(docPath, "utf-8"));
  return doc.full_text || null;
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  ra7160: "R.A. 7160",
  ordinance: "Pitogo Municipal Ordinance",
  irr: "IRR of R.A. 7160",
  dilg_opinion: "DILG Legal Opinion",
  jurisprudence: "SC Jurisprudence",
};

export function buildRAGContext(results: SearchResult[]): string {
  if (results.length === 0) return "";

  const sections: string[] = [];

  for (const result of results) {
    const fullText = getDocumentFullText(result.id);
    const text = fullText || result.snippet;
    // Limit individual document context to 2000 chars to stay within token budgets
    const truncatedText = text.length > 2000 ? text.substring(0, 2000) + "..." : text;
    const label = DOC_TYPE_LABELS[result.doc_type];

    sections.push(
      `[${label}: ${result.title}]\n${truncatedText}`
    );
  }

  return "RELEVANT LEGAL PROVISIONS:\n\n" + sections.join("\n\n---\n\n");
}

// Knowledge base cache for YALA
let cachedKnowledgeBase: Record<string, unknown> | null = null;

function getYalaKnowledgeBase(): Record<string, unknown> {
  if (cachedKnowledgeBase) return cachedKnowledgeBase;

  const kbPath = path.join(process.cwd(), "src/lib/data/yala-knowledge-base.json");
  if (!fs.existsSync(kbPath)) {
    return {};
  }

  cachedKnowledgeBase = JSON.parse(fs.readFileSync(kbPath, "utf-8"));
  return cachedKnowledgeBase!;
}

export function getYalaKnowledgeContext(query: string): string {
  const kb = getYalaKnowledgeBase();
  if (!kb || Object.keys(kb).length === 0) return "";

  const lowerQuery = query.toLowerCase();
  const sections: string[] = [];

  // Always include municipality basics
  const muni = kb.municipality as Record<string, unknown> | undefined;
  if (muni) {
    sections.push(
      `MUNICIPALITY INFO: ${muni.name}, ${muni.province}, ${muni.region}. Population: ${muni.population}. Address: ${muni.address}. Phone: ${muni.phone}. Email: ${muni.email}.`
    );
  }

  // Include office hours
  const hours = kb.office_hours as Record<string, string> | undefined;
  if (hours) {
    sections.push(
      `OFFICE HOURS: Municipal Hall: ${hours.municipal_hall}. SB Sessions: ${hours.sanggunian_sessions}. Note: ${hours.note}.`
    );
  }

  // Match services based on query keywords
  const services = kb.services as Array<Record<string, unknown>> | undefined;
  if (services) {
    const serviceKeywords: Record<string, string[]> = {
      "business permit": ["business", "permit", "negosyo", "bplo", "license", "lisensya"],
      "barangay clearance": ["barangay", "clearance", "brgy"],
      "birth certificate": ["birth", "kapanganakan", "born"],
      "marriage certificate": ["marriage", "kasal", "wedding"],
      "death certificate": ["death", "kamatayan", "patay", "died"],
      "real property tax": ["property", "tax", "amilyar", "rpt", "lupa"],
      "cedula": ["cedula", "community tax", "ctc"],
      "building permit": ["building", "gusali", "construction", "patayo"],
      "zoning": ["zoning", "land use", "gamit ng lupa"],
    };

    for (const service of services) {
      const serviceName = (service.name as string).toLowerCase();
      const matched = Object.entries(serviceKeywords).some(([, keywords]) => {
        const queryMatch = keywords.some((kw) => lowerQuery.includes(kw));
        const serviceMatch = keywords.some((kw) => serviceName.includes(kw));
        return queryMatch && serviceMatch;
      });

      if (matched) {
        let serviceText = `SERVICE: ${service.name}\nOffice: ${service.office}`;
        if (service.requirements) {
          serviceText += `\nRequirements: ${(service.requirements as string[]).join("; ")}`;
        }
        if (service.fees) serviceText += `\nFees: ${service.fees}`;
        if (service.processing_time) serviceText += `\nProcessing Time: ${service.processing_time}`;
        if (service.steps) {
          serviceText += `\nSteps: ${(service.steps as string[]).map((s, i) => `${i + 1}. ${s}`).join(" ")}`;
        }
        if (service.deadline) serviceText += `\nDeadline: ${service.deadline}`;
        if (service.notes) serviceText += `\nNote: ${service.notes}`;
        sections.push(serviceText);
      }
    }
  }

  // Match officials query
  const officialKeywords = ["official", "opisyal", "vice mayor", "sb member", "kagawad", "council", "sanggunian member", "sino"];
  if (officialKeywords.some((kw) => lowerQuery.includes(kw))) {
    const officials = kb.officials as Record<string, unknown> | undefined;
    if (officials) {
      const vm = officials.vice_mayor as Record<string, string>;
      let officialText = `OFFICIALS:\nVice Mayor: ${vm.name} (${vm.position})\nSB Members:`;
      const members = officials.sb_members as Array<Record<string, string>>;
      for (const m of members) {
        officialText += `\n- ${m.name} (Committee: ${m.committee})`;
      }
      const exOfficio = officials.ex_officio as Array<Record<string, string>>;
      for (const e of exOfficio) {
        officialText += `\n- ${e.name} (${e.title}, Committee: ${e.committee})`;
      }
      officialText += `\nSB Secretary: ${officials.sb_secretary}`;
      sections.push(officialText);
    }
  }

  // Match barangay query
  const barangayKeywords = ["barangay", "brgy", "baryo"];
  if (barangayKeywords.some((kw) => lowerQuery.includes(kw))) {
    const barangays = kb.barangays as string[] | undefined;
    if (barangays) {
      sections.push(`BARANGAYS (39 total): ${barangays.join(", ")}`);
    }
  }

  // Match eSANGGUNI platform query
  const platformKeywords = ["esangguni", "platform", "ella", "obra", "yala", "system", "website", "app"];
  if (platformKeywords.some((kw) => lowerQuery.includes(kw))) {
    const platform = kb.esangguni_platform as Record<string, unknown> | undefined;
    if (platform) {
      let platformText = `eSANGGUNI PLATFORM: ${platform.about}`;
      const modules = platform.modules as Record<string, Record<string, string>>;
      for (const [, mod] of Object.entries(modules)) {
        platformText += `\n- ${mod.name}: ${mod.description} (For: ${mod.audience})`;
      }
      sections.push(platformText);
    }
  }

  // Match FAQ
  const faqs = kb.frequently_asked as Array<Record<string, string>> | undefined;
  if (faqs) {
    for (const faq of faqs) {
      const faqLower = faq.question.toLowerCase();
      const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 3);
      if (queryWords.some((w) => faqLower.includes(w))) {
        sections.push(`FAQ: Q: ${faq.question} A: ${faq.answer}`);
      }
    }
  }

  if (sections.length === 0) return "";

  return "PITOGO LGU INFORMATION:\n\n" + sections.join("\n\n");
}

/**
 * LightRAG-First Hybrid RAG
 *
 * Strategy:
 * 1. LightRAG is the PRIMARY retrieval method — provides semantic understanding
 *    regardless of query language (Filipino or English).
 * 2. BM25 runs only when:
 *    a. The query is in English (BM25 fails on Filipino due to language mismatch), OR
 *    b. The query contains exact section/ordinance number references.
 * 3. Context budget: 85% LightRAG, 15% BM25 (when applicable).
 * 4. Graceful degradation: if LightRAG is unavailable, falls back to BM25-only.
 */

// Filipino/Tagalog indicator words — if present, BM25 is skipped
const FILIPINO_INDICATORS = new Set([
  "ang", "ng", "mga", "sa", "na", "at", "ay", "para", "ito", "rin",
  "din", "naman", "po", "kung", "nang", "dahil", "pero", "kaya",
  "hindi", "wala", "siya", "niya", "kanila", "kami", "tayo", "ako",
  "ikaw", "mo", "ko", "natin", "namin", "iyon", "doon", "dito",
  "maari", "maaari", "bang", "isang", "pamamagitan", "resolusyon",
  "ordinansa", "kalsada", "barangay", "munisipyo", "lungsod",
  "probinsya", "sangguniang", "bayan", "panlalawigan", "pambayang",
  "ano", "paano", "bakit", "saan", "kailan", "sino", "ilang",
  "pwede", "dapat", "kailangan", "tungkol", "upang", "bilang",
  "kapangyarihan", "batas", "karapatan", "tungkulin", "serbisyo",
]);

function detectLanguage(query: string): "filipino" | "english" {
  const words = query.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/);
  const filipinoCount = words.filter((w) => FILIPINO_INDICATORS.has(w)).length;
  // Require 3+ Filipino words or >40% of words are Filipino to classify as Filipino.
  // This prevents English queries with proper nouns like "Sangguniang Bayan" from being misclassified.
  return filipinoCount >= 3 || (words.length > 0 && filipinoCount / words.length > 0.4)
    ? "filipino"
    : "english";
}

function hasExactLookup(query: string): boolean {
  // Check if query contains specific section or ordinance number references
  return /(?:section|sec\.?)\s*\d+/i.test(query) ||
    /(?:ordinance|ord|mo)\s*(?:no\.?\s*)?\d+/i.test(query);
}

export async function getHybridContext(
  query: string,
  assistant: "ella" | "obra" | "yala",
  options?: SearchOptions
): Promise<string> {
  const language = detectLanguage(query);
  const useBM25 = language === "english" || hasExactLookup(query);

  // Run LightRAG always; BM25 only when useful
  const [lightragResponse, bm25Results] = await Promise.all([
    queryLightRAG(query, assistant, "hybrid").catch(() => null),
    useBM25 ? Promise.resolve(searchDocuments(query, options)) : Promise.resolve([] as SearchResult[]),
  ]);

  const lightragAvailable =
    lightragResponse !== null &&
    lightragResponse.context !== null &&
    lightragResponse.context.length > 0;

  // ── Graceful Degradation: BM25-only mode ──────────────────────────────
  if (!lightragAvailable) {
    if (bm25Results.length > 0) {
      const bm25Context = buildRAGContext(bm25Results);
      if (bm25Context) {
        return (
          "[DEGRADED MODE: LightRAG unavailable — using BM25 keyword search only]\n\n" +
          bm25Context
        );
      }
    }
    return "";
  }

  // ── LightRAG-Primary Context Assembly ─────────────────────────────────

  // Budget allocation: 85% LightRAG, 15% BM25 (when applicable)
  const lightragBudget = Math.floor(MAX_CONTEXT_CHARS * 0.85);
  const bm25Budget = MAX_CONTEXT_CHARS - lightragBudget;

  // Truncate LightRAG context if necessary
  let lightragContext = lightragResponse!.context;
  if (lightragContext.length > lightragBudget) {
    lightragContext = lightragContext.substring(0, lightragBudget) + "... [truncated]";
  }

  // Build confidence header
  let confidence: string;
  if (useBM25 && bm25Results.length > 0) {
    // Check for cross-validation between LightRAG and BM25
    const lightragSourceIds = new Set<string>();
    for (const src of lightragResponse!.sources ?? []) {
      lightragSourceIds.add(src.toLowerCase());
    }

    const crossValidated = bm25Results.filter(
      (r) =>
        lightragSourceIds.has(r.id.toLowerCase()) ||
        lightragSourceIds.has(r.title.toLowerCase())
    ).length;

    if (crossValidated > 0) {
      confidence = `HIGH (LightRAG semantic + BM25 keyword — ${crossValidated} cross-validated results)`;
    } else {
      confidence = "MEDIUM (LightRAG semantic primary + BM25 complementary — no direct overlap)";
    }
  } else {
    confidence = language === "filipino"
      ? "HIGH (LightRAG semantic retrieval — Filipino query detected, BM25 skipped)"
      : "HIGH (LightRAG semantic retrieval)";
  }

  // Build BM25 complementary section (only for English queries or exact lookups)
  let bm25Section = "";
  if (useBM25 && bm25Results.length > 0) {
    // Filter out documents already covered by LightRAG
    const lightragSourceIds = new Set<string>();
    for (const src of lightragResponse!.sources ?? []) {
      lightragSourceIds.add(src.toLowerCase());
    }

    const complementary = bm25Results.filter(
      (r) =>
        !lightragSourceIds.has(r.id.toLowerCase()) &&
        !lightragSourceIds.has(r.title.toLowerCase())
    );

    if (complementary.length > 0) {
      const complementaryContext = buildRAGContext(complementary);
      if (complementaryContext) {
        const stripped = complementaryContext.replace(
          "RELEVANT LEGAL PROVISIONS:\n\n",
          ""
        );
        bm25Section =
          "\n\n---\n\nCOMPLEMENTARY KEYWORD RESULTS (BM25 — exact matches not covered by semantic search):\n" +
          stripped;

        if (bm25Section.length > bm25Budget) {
          bm25Section = bm25Section.substring(0, bm25Budget) + "... [truncated]";
        }
      }
    }
  }

  const confidenceLine = `RETRIEVAL CONFIDENCE: ${confidence}`;
  const graphHeader = "KNOWLEDGE GRAPH CONTEXT (LightRAG — semantic + relationship-based):";

  return `${confidenceLine}\n\n${graphHeader}\n${lightragContext}${bm25Section}`;
}

/**
 * Ingest a document into LightRAG for knowledge graph indexing.
 * Wrapper around the lightrag.ts ingestDocument function for use by
 * the KB management system.
 *
 * @param docId    - Unique document identifier (e.g., "ra7160-sec-447")
 * @param content  - Full text content of the document
 * @param metadata - Document metadata for graph enrichment
 * @returns true if ingestion succeeded, false otherwise
 */
export async function ingestDocumentToLightRAG(
  docId: string,
  content: string,
  metadata: {
    doc_type: string;
    title: string;
    lgu_id?: string;
    section_number?: string;
    ordinance_number?: string;
  }
): Promise<boolean> {
  return ingestDocument(docId, content, metadata);
}

/**
 * Delete a document from the LightRAG knowledge graph.
 * Wrapper around the lightrag.ts deleteDocument function for use by
 * the KB management system.
 *
 * @param docId - Unique document identifier to remove
 * @returns true if deletion succeeded, false otherwise
 */
export async function deleteDocumentFromLightRAG(
  docId: string
): Promise<boolean> {
  return deleteDocument(docId);
}
