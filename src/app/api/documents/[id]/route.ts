export const runtime = "nodejs";

import { NextResponse, NextRequest } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";
import { getDocumentFullText, getSearchIndex } from "@/lib/ai/rag";

const VALID_ID_PATTERNS = [
  /^ra7160-sec-[\w-]+$/,
  /^ord-[\w-]+$/,
  /^irr-irr-rule-[\w-]+$/,
  /^sc-[\w-]+$/,       // SC jurisprudence: sc-sc-gr-182069
  /^lo-[\w-]+$/,        // DILG opinions: lo-lo-022-s2018
];

function isValidDocId(id: string): boolean {
  return VALID_ID_PATTERNS.some((p) => p.test(id));
}

export const GET = withUserAuth(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  if (!isValidDocId(id)) {
    return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
  }

  const fullText = getDocumentFullText(id);
  if (fullText) {
    return NextResponse.json({ id, full_text: fullText });
  }

  // Flexible ordinance lookup: try zero-padded variants
  // e.g. ord-MO-1-S2020 -> ord-MO-01-S2020 -> ord-MO-001-S2020
  const ordMatch = id.match(/^ord-([A-Z]+)-(\d+)-S(\d{4})(.*)$/);
  if (ordMatch) {
    const [, type, num, year, suffix] = ordMatch;
    const index = getSearchIndex();
    const candidates = index.documents.filter(
      (d) =>
        d.doc_type === "ordinance" &&
        d.ordinance_type?.toUpperCase() === type &&
        d.series_year === parseInt(year) &&
        d.ordinance_number?.replace(/^0+/, "") === num.replace(/^0+/, "")
    );

    if (candidates.length > 0) {
      const candidateId = candidates[0].id + (suffix || "");
      const candidateText = getDocumentFullText(candidateId) || getDocumentFullText(candidates[0].id);
      if (candidateText) {
        return NextResponse.json({ id: candidates[0].id, full_text: candidateText });
      }
    }
  }

  return NextResponse.json({ error: "Document not found" }, { status: 404 });
});
