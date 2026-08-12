import type { DocumentRecord, SearchIndex } from "../src/types";

// English + Filipino stop words
const STOP_WORDS = new Set([
  // English
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
  // Filipino
  "ang", "ng", "mga", "sa", "na", "at", "ay", "para", "ito", "rin",
  "din", "naman", "po", "kung", "nang", "dahil", "pero", "kaya",
  "hindi", "wala", "siya", "niya", "kanila", "kami", "tayo", "ako",
  "ikaw", "ka", "mo", "ko", "natin", "namin", "iyon", "doon", "dito",
  "pag", "kapag", "mula", "hanggang", "tungkol", "upang", "bilang",
]);

export function tokenize(text: string): Record<string, number> {
  const terms: Record<string, number> = {};
  const words = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  for (const word of words) {
    terms[word] = (terms[word] || 0) + 1;
  }
  return terms;
}

export function buildSearchIndex(documents: DocumentRecord[]): SearchIndex {
  // Compute IDF (inverse document frequency) for each term
  const docFreq: Record<string, number> = {};
  for (const doc of documents) {
    const uniqueTerms = new Set(Object.keys(doc.terms));
    for (const term of uniqueTerms) {
      docFreq[term] = (docFreq[term] || 0) + 1;
    }
  }

  const totalDocs = documents.length;
  const idf: Record<string, number> = {};
  for (const [term, df] of Object.entries(docFreq)) {
    // BM25 IDF formula: log((N - df + 0.5) / (df + 0.5) + 1)
    idf[term] = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
  }

  // Compute average document length
  let totalTermCount = 0;
  for (const doc of documents) {
    totalTermCount += Object.values(doc.terms).reduce((a, b) => a + b, 0);
  }
  const avgDocLength = totalTermCount / totalDocs;

  return {
    documents,
    idf,
    avgDocLength,
    totalDocs,
  };
}
