import { NextResponse, NextRequest } from "next/server";
import { withUserAuth } from "@/lib/user-auth-middleware";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
// Hybrid OCR: qwen3.7-plus for images (better reasoning), gemini-2.5-flash for PDFs (supports PDF input)
const IMAGE_EXTRACT_MODEL = "qwen/qwen3.7-plus";
const PDF_EXTRACT_MODEL = "google/gemini-2.5-flash";

// Use Node.js runtime so large multipart uploads are handled without edge limits
export const runtime = "nodejs";
// Allow up to 60s for large scanned PDFs to be processed
export const maxDuration = 60;

const EXTRACTION_PROMPT = `You are a document text extractor for Philippine municipal ordinances.
Extract ALL text from the provided document or image exactly as written, preserving:
- Section numbers and titles
- Whereas clauses
- Numbered provisions
- Signatures and dates
- All legal language

Output ONLY the extracted text with no commentary, no markdown, no explanations.
If the image is unclear or not an ordinance document, output the best text you can read.`;

export const POST = withUserAuth(async (request: NextRequest) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Text extraction service not configured." },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 10 MB." },
      { status: 400 }
    );
  }

  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();

  // --- Plain text: no LLM needed ---
  if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
    const text = await file.text();
    return NextResponse.json({ text: text.trim() });
  }

  // --- Image or PDF: send to LLM via OpenRouter vision ---
  const isImage =
    mimeType.startsWith("image/") ||
    [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"].some((ext) =>
      fileName.endsWith(ext)
    );
  const isPdf = mimeType === "application/pdf" || fileName.endsWith(".pdf");

  if (!isImage && !isPdf) {
    return NextResponse.json(
      {
        error:
          "Unsupported file type. Please upload an image (JPG, PNG, WEBP) or PDF.",
      },
      { status: 400 }
    );
  }

  // Convert file to base64
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // For PDF, use application/pdf MIME; for images use the file's MIME type
  const imageMime = isPdf ? "application/pdf" : mimeType;

  const payload = {
    model: isPdf ? PDF_EXTRACT_MODEL : IMAGE_EXTRACT_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${imageMime};base64,${base64}`,
            },
          },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0,
  };

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://obra.esangguni.bayanaihan.net",
        "X-Title": "OBRA - Ordinance Text Extractor",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter extraction error:", err);
      return NextResponse.json(
        { error: "Text extraction failed. Please try again or paste manually." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const extracted: string =
      data.choices?.[0]?.message?.content?.trim() ?? "";

    if (!extracted) {
      return NextResponse.json(
        { error: "No text could be extracted from the file." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: extracted });
  } catch (err) {
    console.error("Extract route error:", err);
    return NextResponse.json(
      { error: "Extraction service unavailable. Please paste text manually." },
      { status: 503 }
    );
  }
});
