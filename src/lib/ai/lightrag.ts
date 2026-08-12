/**
 * LightRAG Client - Queries the LightRAG knowledge graph service
 * for semantic + graph-based legal retrieval.
 *
 * The service runs as a Docker container alongside eSangguni.
 * Falls back gracefully if the service is unavailable.
 */

const LIGHTRAG_URL = process.env.LIGHTRAG_SERVICE_URL || "http://lightrag-service:8020";
const LIGHTRAG_TIMEOUT = 30000; // 30s timeout

export interface LightRAGResponse {
  context: string;
  mode: string;
  query_time_ms: number;
  sources: string[];
}

export interface LightRAGHybridResponse {
  merged_context: string;
  lightrag_context: string;
  bm25_context: string;
  query_time_ms: number;
}

/**
 * Query LightRAG for semantic + graph-based retrieval context.
 * Returns null if the service is unavailable (graceful fallback).
 */
export async function queryLightRAG(
  question: string,
  assistant: "ella" | "obra" | "yala",
  mode = "hybrid"
): Promise<LightRAGResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIGHTRAG_TIMEOUT);

    const res = await fetch(`${LIGHTRAG_URL}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        mode,
        top_k: assistant === "yala" ? 5 : 8,
        assistant,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[LightRAG] Query failed: ${res.status} ${res.statusText}`);
      return null;
    }

    return await res.json();
  } catch (error) {
    // Graceful fallback - LightRAG being down should not break the chat
    console.warn(`[LightRAG] Service unavailable: ${error instanceof Error ? error.message : "Unknown error"}`);
    return null;
  }
}

/**
 * Query LightRAG with hybrid endpoint (combined with BM25 results).
 */
export async function queryLightRAGHybrid(
  question: string,
  bm25Results?: Array<{ title: string; snippet: string }>
): Promise<LightRAGHybridResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIGHTRAG_TIMEOUT);

    const res = await fetch(`${LIGHTRAG_URL}/query/hybrid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        bm25_results: bm25Results,
        top_k: 10,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Health check - verify LightRAG service is reachable.
 */
export async function checkLightRAGHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${LIGHTRAG_URL}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return false;
    const data = await res.json();
    return data.status === "healthy" && data.rag_loaded === true;
  } catch {
    return false;
  }
}

/**
 * Ingest a document into LightRAG for knowledge graph indexing.
 * Sends the document content and metadata to the LightRAG service for
 * entity extraction, relationship mapping, and graph insertion.
 *
 * Returns true on success, false on failure (timeout, network error, etc.).
 */
export async function ingestDocument(
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
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIGHTRAG_TIMEOUT);

    const res = await fetch(`${LIGHTRAG_URL}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doc_id: docId,
        content,
        metadata,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[LightRAG] Ingest failed for doc "${docId}": ${res.status} ${res.statusText}`);
      return false;
    }

    console.log(`[LightRAG] Successfully ingested doc "${docId}"`);
    return true;
  } catch (error) {
    console.warn(
      `[LightRAG] Ingest failed for doc "${docId}": ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return false;
  }
}

/**
 * Delete a document from the LightRAG knowledge graph.
 * Removes the document and its associated entities/relationships from the graph.
 *
 * Returns true on success, false on failure (timeout, network error, etc.).
 */
export async function deleteDocument(docId: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LIGHTRAG_TIMEOUT);

    const res = await fetch(`${LIGHTRAG_URL}/documents/${encodeURIComponent(docId)}`, {
      method: "DELETE",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[LightRAG] Delete failed for doc "${docId}": ${res.status} ${res.statusText}`);
      return false;
    }

    console.log(`[LightRAG] Successfully deleted doc "${docId}"`);
    return true;
  } catch (error) {
    console.warn(
      `[LightRAG] Delete failed for doc "${docId}": ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return false;
  }
}

/**
 * Get LightRAG indexing status and statistics.
 * Returns document count, entity count, relationship count, and service status.
 *
 * Returns null if the service is unavailable.
 */
export async function getLightRAGStats(): Promise<{
  total_documents: number;
  total_entities: number;
  total_relations: number;
  status: string;
} | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s for stats

    const res = await fetch(`${LIGHTRAG_URL}/stats`, { signal: controller.signal });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[LightRAG] Stats request failed: ${res.status} ${res.statusText}`);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.warn(
      `[LightRAG] Stats request failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return null;
  }
}
