import type { Citation } from "@/types";

/**
 * Maps a Citation object to a document ID that can be used with /api/documents/[id].
 *
 * Document ID patterns:
 * - R.A. 7160: "ra7160-sec-{N}" (e.g. "ra7160-sec-444")
 * - Ordinance: "ord-{TYPE}-{NUM}-S{YEAR}" with inconsistent zero-padding
 *   (e.g. "ord-MO-001-S2003", "ord-MO-01-S2010", "ord-MO-10-S2008")
 * - IRR: "irr-irr-rule-{roman}" (e.g. "irr-irr-rule-xxxii")
 */
export function citationToDocId(citation: Citation): string | null {
  if (!citation.doc_type) return null;

  switch (citation.doc_type) {
    case "ra7160": {
      // Extract numeric section from strings like "444", "447(a)", "536"
      const match = citation.section.match(/^(\d+[A-Za-z]?)$/);
      if (!match) return null;
      // Strip letter suffix for file lookup: "447(a)" -> "447"
      const sectionNum = match[1].replace(/[A-Za-z]$/, "");
      return `ra7160-sec-${sectionNum}`;
    }

    case "ordinance": {
      // Section format: "MO No. 001, S. 2003" or "MO No. 1, S. 2010"
      const match = citation.section.match(
        /^(?:MO|AO)\s+No\.?\s*(\d+[-\d]*),?\s*S\.?\s*(\d{4})$/
      );
      if (!match) return null;
      const rawNum = match[1];
      const year = match[2];

      // Try multiple padding variants since IDs are inconsistent
      const baseNum = rawNum.replace(/^0+/, "");
      const padded3 = baseNum.padStart(3, "0");
      const padded2 = baseNum.padStart(2, "0");

      // Return the most common format (3-digit padding) as primary ID
      // The server-side route will try flexible lookups if this doesn't match
      return `ord-MO-${padded3}-S${year}`;
    }

    case "irr": {
      // Section format: "Rule XXXII" or just the roman numeral
      const match = citation.section.match(/(?:Rule\s+)?([IVXLCDM]+)/i);
      if (!match) return null;
      return `irr-irr-rule-${match[1].toLowerCase()}`;
    }

    default:
      return null;
  }
}

/**
 * Returns all possible doc IDs for a citation (for ordinance padding variants).
 */
export function citationToDocIdCandidates(citation: Citation): string[] {
  const primary = citationToDocId(citation);
  if (!primary || citation.doc_type !== "ordinance") return primary ? [primary] : [];

  const match = citation.section.match(
    /^(?:MO|AO)\s+No\.?\s*(\d+[-\d]*),?\s*S\.?\s*(\d{4})$/
  );
  if (!match) return [primary];

  const baseNum = match[1].replace(/^0+/, "");
  const year = match[2];
  const candidates = new Set<string>();

  // Add all padding variants
  candidates.add(`ord-MO-${baseNum}-S${year}`);
  candidates.add(`ord-MO-${baseNum.padStart(2, "0")}-S${year}`);
  candidates.add(`ord-MO-${baseNum.padStart(3, "0")}-S${year}`);

  return Array.from(candidates);
}
