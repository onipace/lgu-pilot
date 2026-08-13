import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";

const METER_URL = process.env.TOKEN_METER_URL || "http://token-meter:3084";
const PROXY_TIMEOUT_MS = 5000;

// Allowed proxy targets — prevents path traversal to arbitrary endpoints
const ALLOWED_TARGETS = new Set([
  "stats",
  "by-module",
  "by-route",
  "by-user",
  "timeseries",
  "costs",
  "budgets",
  "export",
  "pricing",
]);

/**
 * Catch-all proxy route: /api/admin/tokens/[...proxy]
 * Forwards all requests to the token-meter service.
 * Admin-only (gated by withAuth).
 *
 * Examples:
 *   GET  /api/admin/tokens/stats         → token-meter GET /api/stats
 *   GET  /api/admin/tokens/by-module      → token-meter GET /api/by-module
 *   PUT  /api/admin/tokens/budgets        → token-meter PUT /api/budgets
 *   GET  /api/admin/tokens/export?format=csv → token-meter GET /api/export?format=csv
 */
export const GET = withAuth(async (request, _session, context) => {
  try {
    const params = await context.params;
    const segments: string[] = params.proxy;

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: "Invalid proxy path" },
        { status: 400 }
      );
    }

    const target = segments.join("/");
    if (!ALLOWED_TARGETS.has(target)) {
      return NextResponse.json(
        { error: `Unknown token meter endpoint: ${target}` },
        { status: 404 }
      );
    }

    const { search } = new URL(request.url);
    const meterUrl = `${METER_URL}/api/${target}${search}`;

    const meterResponse = await fetch(meterUrl, {
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });

    if (!meterResponse.ok) {
      return NextResponse.json(
        { error: "Token meter unavailable" },
        { status: 503 }
      );
    }

    // For export endpoint, the response might be CSV — pass through content-type
    const contentType = meterResponse.headers.get("content-type") || "application/json";
    const contentDisposition = meterResponse.headers.get("content-disposition");

    // For non-JSON responses (e.g., CSV export), return as text
    if (contentType.includes("text/csv")) {
      const text = await meterResponse.text();
      const headers: Record<string, string> = {
        "Content-Type": "text/csv",
      };
      if (contentDisposition) {
        headers["Content-Disposition"] = contentDisposition;
      }
      return new NextResponse(text, { status: 200, headers });
    }

    const data = await meterResponse.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/tokens proxy] GET error:", err);
    return NextResponse.json(
      { error: "Token meter unavailable" },
      { status: 503 }
    );
  }
});

export const PUT = withAuth(async (request, _session, context) => {
  try {
    const params = await context.params;
    const segments: string[] = params.proxy;

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: "Invalid proxy path" },
        { status: 400 }
      );
    }

    const target = segments.join("/");
    if (!ALLOWED_TARGETS.has(target)) {
      return NextResponse.json(
        { error: `Unknown token meter endpoint: ${target}` },
        { status: 404 }
      );
    }

    // Only budgets and pricing accept PUT
    if (target !== "budgets" && target !== "pricing") {
      return NextResponse.json(
        { error: "Method not allowed for this endpoint" },
        { status: 405 }
      );
    }

    const body = await request.json();
    const meterUrl = `${METER_URL}/api/${target}`;

    const meterResponse = await fetch(meterUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });

    if (!meterResponse.ok) {
      const errorData = await meterResponse.json().catch(() => ({}));
      return NextResponse.json(
        errorData.error ? errorData : { error: "Token meter error" },
        { status: meterResponse.status }
      );
    }

    const data = await meterResponse.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[admin/tokens proxy] PUT error:", err);
    return NextResponse.json(
      { error: "Token meter unavailable" },
      { status: 503 }
    );
  }
});
