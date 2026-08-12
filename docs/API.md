# PILLAR API Documentation

**Version:** 1.0.0  
**Base URL:** `https://pillar.bayanaihan.net`  
**Runtime:** Node.js (Next.js 15.3.8 API Routes)  
**Database:** SQLite via better-sqlite3 (WAL mode)

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Authentication](#authentication)
3. [LIKHA API Endpoints](#likha-api-endpoints)
4. [LINAW API Endpoints](#linaw-api-endpoints)
5. [Auth API Endpoints](#auth-api-endpoints)
6. [Health Endpoint](#health-endpoint)
7. [Error Codes & Response Shapes](#error-codes--response-shapes)
8. [Database Schema](#database-schema)
9. [Data Flow Diagrams](#data-flow-diagrams)

---

## System Architecture

```
                        +--------------------------+
                        |       CLIENT BROWSER      |
                        |  (LGU User Session Cookie)|
                        +-------------+------------+
                                      |
                                      | HTTPS
                                      v
                        +--------------------------+
                        |     NGINX REVERSE PROXY  |
                        |   (pillar.bayanaihan.net) |
                        +-------------+------------+
                                      |
                                      v
                    +-------------------------------------+
                    |        NEXT.JS 15.3.8 SERVER        |
                    |                                     |
                    |  +-----------+    +--------------+  |
                    |  |  Pages    |    |  API Routes   |  |
                    |  |  (React)  |    |  (Node.js)    |  |
                    |  +-----------+    +-------+-------+  |
                    |                           |          |
                    |  +------------------------+--------+ |
                    |  |        MIDDLEWARE LAYER           | |
                    |  |  withUserAuth() — session cookie  | |
                    |  |  withAuth() — admin session       | |
                    |  +------------------------+---------+ |
                    |                           |          |
                    |  +----------+  +---------+--------+  |
                    |  |  LIKHA   |  |      LINAW        |  |
                    |  |  Agents  |  |      Agents       |  |
                    |  |  (OCR,   |  |  (Classify,       |  |
                    |  |  Parse,  |  |   CrossRef,       |  |
                    |  |  Search, |  |   Assemble,       |  |
                    |  |  Export) |  |   Export)         |  |
                    |  +----+-----+  +---------+--------+  |
                    |       |                |             |
                    |  +----+----------------+---------+   |
                    |  |     better-sqlite3 (WAL)        |  |
                    |  |     data/workshop.db            |  |
                    |  +-------------------------------+  |
                    |                                     |
                    +----------------+--------------------+
                                     |
                          +----------+----------+
                          |   OpenRouter API    |
                          |  gemini-2.5-flash   |
                          |  qwen3.7-plus       |
                          +---------------------+
```

### Module Isolation

LIKHA and LINAW are **standalone modules** with independent:
- Database tables (`archived_ordinances` vs `linaw_ordinances`)
- Search namespaces (separate BM25 indices)
- Agent pipelines (independent processing chains)
- Export formats (DILG for LIKHA, L1 interchange for both)

They communicate through the **L1 Interchange Format** — a versioned JSON package specification.

---

## Authentication

### User Authentication (LGU Users)

All LIKHA and LINAW endpoints require LGU user authentication via session cookies.

**Flow:**
1. User logs in via `POST /api/auth/user/login` with `{ email, password }`
2. Server validates credentials (scrypt hash comparison)
3. Server creates a session (random 32-byte hex, 24h expiry) in `user_sessions` table
4. Server sets `pillar_user_session` cookie (HttpOnly, SameSite=Lax)
5. All subsequent requests include the cookie automatically
6. `withUserAuth()` middleware validates the session on every protected request

**Session Cookie:**
```
Set-Cookie: pillar_user_session=<session_id>; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400
```

**Unauthorized Response (401):**
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

**Forbidden Response (403):**
```json
{
  "error": "Forbidden: Super admin access required",
  "code": "FORBIDDEN"
}
```

### Admin Authentication

Admin endpoints use a separate auth flow with `pillar_session` cookie and `admin_sessions` table. Admin roles: `super_admin` and `lgu_admin`.

---

## LIKHA API Endpoints

### POST /api/likha/upload — Batch File Upload (L001)

Upload up to 10 scanned ordinance files (PDF/JPG/PNG, max 20 MB each). SHA-256 deduplication runs before persistence.

**Auth:** `withUserAuth`  
**Content-Type:** `multipart/form-data`

**Request:**
```
POST /api/likha/upload
Cookie: pillar_user_session=<session_id>
Content-Type: multipart/form-data

files: <File> (up to 10 files, field name "files")
```

**Response (200):**
```json
{
  "batchId": "uuid-v4",
  "accepted": 5,
  "duplicates": 0,
  "rejected": 0,
  "files": [
    {
      "originalFilename": "ordinance-2024-015.pdf",
      "status": "accepted",
      "recordId": "uuid-v4",
      "fileHash": "sha256-hex-string",
      "mimeType": "application/pdf",
      "sizeBytes": 1048576
    },
    {
      "originalFilename": "duplicate-file.pdf",
      "status": "duplicate",
      "sizeBytes": 524288,
      "fileHash": "sha256-hex-string",
      "existingRecordId": "uuid-v4"
    }
  ]
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 400 | `NO_FILES` | No files provided |
| 400 | `TOO_MANY_FILES` | More than 10 files in batch |
| 400 | `FILE_TOO_LARGE` | File exceeds 20 MB limit |
| 400 | `UNSUPPORTED_TYPE` | File type not PDF/JPG/PNG |
| 401 | `UNAUTHORIZED` | Missing or invalid session |
| 500 | — | Upload failed |

---

### POST /api/likha/pipeline — OCR + Metadata Pipeline (L002/L003)

Runs agents 2-3 (OCR + metadata extraction) over `processing` records owned by the authenticated user.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "batchId": "uuid-v4",
  "fileIds": ["uuid-v4", "uuid-v4"],
  "pipelineId": "uuid-v4"
}
```

- `fileIds` (optional): Specific record IDs to process. If omitted, processes all `processing` records for the user.
- `pipelineId` (optional): Custom pipeline ID for audit trail. Auto-generated if omitted.

**Response (200):**
```json
{
  "pipelineId": "uuid-v4",
  "batchId": "uuid-v4",
  "processed": 5,
  "results": [
    {
      "recordId": "uuid-v4",
      "status": "success",
      "ordinanceNumber": 15,
      "seriesYear": 2024,
      "title": "An Act Appropriating Funds...",
      "sectionCount": 12,
      "extractionConfidence": {
        "ordinanceNumber": 0.95,
        "seriesYear": 0.98,
        "title": 0.87,
        "sectionCount": 0.92
      }
    }
  ]
}
```

---

### GET /api/likha/archive — List/Search Archives (L005/L006)

List and search published ordinances with BM25 full-text search (when `q` is provided) or SQL listing.

**Auth:** `withUserAuth`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | `""` | BM25 search query (triggers full-text search) |
| `yearFrom` | integer | — | Filter: minimum series year |
| `yearTo` | integer | — | Filter: maximum series year |
| `status` | string | — | Legal status: `active`, `amended`, `repealed`, `superseded`, `expired` |
| `archiveStatus` | string | `"published"` | Archive status: `processing`, `pending_review`, `published`, `flagged` |
| `subject` | string | — | Filter by subject tag |
| `page` | integer | `1` | Page number (min 1) |
| `limit` | integer | `20` | Items per page (1-100) |

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid-v4",
      "ordinanceNumber": 15,
      "seriesYear": 2024,
      "title": "An Act Appropriating Funds...",
      "status": "active",
      "archiveStatus": "published",
      "subjectTags": ["appropriations", "finance"],
      "sectionCount": 12,
      "createdAt": "2026-08-09T10:00:00",
      "snippet": "&lt;p&gt;Be it ordained by the Sangguniang Bayan..."
    }
  ],
  "total": 349,
  "page": 1,
  "limit": 20,
  "tookMs": 45
}
```

**Notes:**
- When `q` is provided, BM25 search is used with self-healing index rebuild if the index is empty
- Snippets are HTML-escaped server-side; `<mark>` tags wrap search terms only for `q` searches
- Without `q`, SQL listing returns an escaped leading excerpt (first 200 chars)

---

### GET /api/likha/archive/:id — Record Detail (L004/L006)

Retrieve full detail for a single archived ordinance, including scan availability and classification history.

**Auth:** `withUserAuth`

**Response (200):**
```json
{
  "record": {
    "id": "uuid-v4",
    "ordinanceNumber": 15,
    "seriesYear": 2024,
    "title": "An Act Appropriating Funds...",
    "content": "Full extracted text...",
    "summary": "AI-generated summary...",
    "subjectTags": ["appropriations", "finance"],
    "status": "active",
    "archiveStatus": "published",
    "sourceType": "scan",
    "originalFilename": "ordinance-2024-015.pdf",
    "scanFilePath": "data/uploads/likha/uuid__ordinance-2024-015.pdf",
    "fileHash": "sha256-hex",
    "extractionConfidence": {
      "ordinanceNumber": 0.95,
      "seriesYear": 0.98,
      "title": 0.87,
      "sectionCount": 0.92
    },
    "uploadedById": "uuid-v4",
    "verifiedById": "uuid-v4",
    "createdAt": "2026-08-09T10:00:00",
    "updatedAt": "2026-08-09T10:05:00"
  },
  "scanAvailable": true,
  "scanUrl": "/api/likha/archive/uuid-v4/scan",
  "scanMimeType": "application/pdf",
  "classifications": [
    {
      "id": "uuid-v4",
      "category": "appropriations",
      "confidence": 0.91,
      "assignedBy": "ai-agent",
      "createdAt": "2026-08-09T10:03:00"
    }
  ]
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 404 | `NOT_FOUND` | Record not found |

---

### PUT /api/likha/archive/:id — Verification Decision (L004)

Submit a human verification decision (approve/edit/reject) for a pending_review record. On `approve`, the Archiver agent runs automatically to publish the record.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "action": "approve",
  "ordinanceNumber": 15,
  "seriesYear": 2024,
  "title": "An Act Appropriating Funds...",
  "status": "active",
  "subjectTags": ["appropriations"],
  "rejectionReason": ""
}
```

- `action`: `"approve"` | `"edit"` | `"reject"` (required)
- For `edit`: include corrected fields (`ordinanceNumber`, `seriesYear`, `title`, `status`, `subjectTags`)
- For `reject`: include `rejectionReason` (required)

**Response (200) — Approve:**
```json
{
  "recordId": "uuid-v4",
  "action": "approve",
  "archiveStatus": "published",
  "published": true
}
```

**Response (200) — Reject:**
```json
{
  "recordId": "uuid-v4",
  "action": "reject",
  "archiveStatus": "flagged"
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_BODY` | Invalid JSON or missing action |
| 400 | `VALIDATION` | Invalid verification action |
| 404 | `NOT_FOUND` | Record not found |
| 409 | `CONFLICT` | Record not in eligible status |

---

### GET /api/likha/archive/:id/scan — Scan Image Stream (L006)

Stream the stored scan file (PDF/image) for an archived ordinance. Auth-gated; files are never served from public directories.

**Auth:** `withUserAuth`

**Response (200):**
```
Content-Type: application/pdf (or image/jpeg, image/png)
Content-Disposition: inline; filename="ordinance-2024-015.pdf"

<binary file data>
```

**Security:** Path-traversal guard ensures resolved path stays within `data/uploads/likha/`.

---

### POST /api/likha/classify — Batch Classification (L007)

Run AI classification over multiple ordinance records. Eligible records: `pending_review` and `published` status.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "ordinanceIds": ["uuid-v4", "uuid-v4", "uuid-v4"]
}
```

**Response (200):**
```json
{
  "classified": 3,
  "skipped": 0,
  "results": [
    {
      "recordId": "uuid-v4",
      "categories": ["appropriations", "finance"],
      "confidence": 0.91,
      "assignedBy": "ai-agent"
    }
  ]
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_BODY` | ordinanceIds must be a non-empty array |
| 500 | — | Classification failed |

---

### PUT /api/likha/classify/:id — Classification Override (L007)

Replace a record's AI-assigned classifications with human-selected categories.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "categories": ["taxation", "revenue"]
}
```

**Response (200):**
```json
{
  "recordId": "uuid-v4",
  "categories": ["taxation", "revenue"],
  "assignedBy": "user-uuid",
  "confidence": null
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_BODY` | categories must be a non-empty array |
| 404 | `NOT_FOUND` | Record not found |
| 409 | `CONFLICT` | Record in processing status |

---

### GET /api/likha/stats — Archive Statistics (L006)

Return aggregate statistics for the LIKHA archive dashboard.

**Auth:** `withUserAuth`

**Response (200):**
```json
{
  "archived": 349,
  "published": 312,
  "pendingReview": 25,
  "flagged": 12,
  "byYear": {
    "2024": 45,
    "2023": 38,
    "2022": 31
  },
  "byStatus": {
    "active": 280,
    "amended": 20,
    "repealed": 12
  },
  "bySubject": {
    "appropriations": 45,
    "taxation": 38,
    "zoning": 22
  },
  "bm25Indexed": 312
}
```

---

### POST /api/likha/export-dilg — DILG MC 2026-041 Export (L010)

Export published ordinances in DILG submission format. Returns a JSON attachment.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "ordinanceIds": ["uuid-v4", "uuid-v4"]
}
```

- `ordinanceIds` (optional): If omitted, exports ALL published records. If `[]`, returns valid empty package. Any non-published ID triggers 409.

**Response (200):**
```
Content-Type: application/json
Content-Disposition: attachment; filename="likha-dilg-mc-2026-041-2026-08-09.json"

{
  "manifest": {
    "format": "dilg-mc-2026-041",
    "version": "1.0.0",
    "exportedAt": "2026-08-09T12:00:00Z",
    "recordCount": 5,
    "exportedBy": "user-uuid"
  },
  "records": [...]
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_BODY` | Invalid ordinanceIds format |
| 409 | `CONFLICT` | Records not eligible (not published) |

---

### POST /api/likha/export-package — L1 Interchange Export (L013)

Export published ordinances in the L1 interchange format for transfer to LINAW or compatible systems.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "ordinanceIds": ["uuid-v4", "uuid-v4"]
}
```

- Same semantics as DILG export: omitted = all published, `[]` = empty package, ineligible IDs = 409.

**Response (200):**
```
Content-Type: application/json
Content-Disposition: attachment; filename="pillar-likha-l1-package-2026-08-09T12-00-00-000Z.json"

{
  "manifest": {
    "format": "l1-interchange",
    "version": "1.0.0",
    "source": {
      "module": "likha",
      "recordCount": 5
    },
    "exportedAt": "2026-08-09T12:00:00.000Z"
  },
  "packageHash": "sha256-hex",
  "records": [...]
}
```

---

## LINAW API Endpoints

### POST /api/linaw/import — Bulk Import (N013)

Import ordinances from JSON, CSV, or DOCX files. Validates per record, inserts in a single transaction, reports duplicates.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json` | `text/csv` | `multipart/form-data`

**Request (JSON):**
```json
[
  {
    "ordinanceNumber": 15,
    "seriesYear": 2024,
    "title": "An Act Appropriating Funds...",
    "content": "Full text of the ordinance...",
    "subjectTags": ["appropriations", "finance"]
  }
]
```

**Request (File Upload):**
```
POST /api/linaw/import
Content-Type: multipart/form-data

file: <File> (.json, .csv, or .docx)
```

**Response (200):**
```json
{
  "batchId": "uuid-v4",
  "imported": 50,
  "skippedDuplicates": 3,
  "records": [
    {
      "id": "uuid-v4",
      "library_status": "pending_review"
    }
  ],
  "invalidRecords": [
    {
      "row": 15,
      "reason": "Missing required field: title"
    }
  ]
}
```

**Limits:** Maximum 500 records per batch.

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 400 | `UNSUPPORTED_FORMAT` | Not JSON/CSV/DOCX |
| 400 | `INVALID_PAYLOAD` | Malformed JSON/CSV |
| 400 | `INVALID_DOCX` | DOCX parsing failed |
| 400 | `TOO_MANY_RECORDS` | Exceeds 500 record limit |
| 400 | `NO_RECORDS` | No valid records found |
| 500 | — | Import failed |

---

### GET /api/linaw/library — Library List (N001)

List and search the LINAW ordinance library with SQL LIKE search.

**Auth:** `withUserAuth`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | `""` | Search query (SQL LIKE over title + content) |
| `libraryStatus` | string | — | Filter: `processing`, `pending_review`, `ready`, `rejected` |
| `page` | integer | `1` | Page number (min 1) |
| `limit` | integer | `20` | Items per page (1-100) |

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid-v4",
      "ordinanceNumber": 15,
      "seriesYear": 2024,
      "title": "An Act Appropriating Funds...",
      "status": "active",
      "libraryStatus": "ready",
      "sourceType": "import",
      "subjectTags": ["appropriations"],
      "snippet": "&lt;p&gt;Be it ordained...",
      "updatedAt": "2026-08-09T10:00:00"
    }
  ],
  "total": 349,
  "page": 1,
  "limit": 20,
  "tookMs": 12
}
```

---

### PUT /api/linaw/library — Manual Entry (N014)

Manually create a new ordinance record in the LINAW library.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "ordinanceNumber": 100,
  "seriesYear": 2025,
  "title": "An Act to Regulate...",
  "content": "Full text...",
  "subjectTags": ["regulation"]
}
```

**Response (201):**
```json
{
  "record": {
    "id": "uuid-v4",
    "ordinanceNumber": 100,
    "seriesYear": 2025,
    "title": "An Act to Regulate...",
    "libraryStatus": "pending_review"
  }
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION` | Missing required fields |
| 409 | `CONFLICT` | Duplicate (ordinance_number, series_year) |

---

### GET /api/linaw/library/:id — Library Record Detail

Retrieve full detail for a single LINAW library record.

**Auth:** `withUserAuth`

**Response (200):**
```json
{
  "record": {
    "id": "uuid-v4",
    "ordinanceNumber": 15,
    "seriesYear": 2024,
    "title": "An Act Appropriating Funds...",
    "content": "Full text...",
    "summary": "AI summary...",
    "subjectTags": ["appropriations"],
    "status": "active",
    "sourceType": "import",
    "libraryStatus": "ready",
    "uploadedById": "uuid-v4",
    "verifiedById": "uuid-v4",
    "createdAt": "2026-08-09T10:00:00",
    "updatedAt": "2026-08-09T10:05:00"
  },
  "scanAvailable": true,
  "scanUrl": "/api/linaw/library/uuid-v4/scan",
  "scanMimeType": "application/pdf"
}
```

---

### PUT /api/linaw/library/:id — Verification Decision

Approve, reject, or edit a pending_review LINAW library record.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "action": "approve",
  "ordinanceNumber": 15,
  "seriesYear": 2024,
  "title": "Corrected Title...",
  "status": "active",
  "subjectTags": ["appropriations"]
}
```

- `action`: `"approve"` | `"reject"` | `"edit"` (required)

**Response (200):**
```json
{
  "recordId": "uuid-v4",
  "action": "approve",
  "libraryStatus": "ready"
}
```

---

### GET /api/linaw/library/:id/scan — Scan Image Stream

Stream the stored scan file for a LINAW library record.

**Auth:** `withUserAuth`

**Response (200):**
```
Content-Type: application/pdf (or image/jpeg, image/png)
Content-Disposition: inline; filename="ordinance-scan.pdf"
Cache-Control: private, max-age=0

<binary file data>
```

---

### GET /api/linaw/inventory — Inventory Dashboard (N001)

Return aggregate inventory statistics for the LINAW dashboard.

**Auth:** `withUserAuth`

**Response (200):**
```json
{
  "totalOrdinances": 349,
  "byLibraryStatus": {
    "ready": 300,
    "pending_review": 30,
    "rejected": 19
  },
  "byLegalStatus": {
    "active": 280,
    "amended": 40,
    "repealed": 29
  },
  "bySourceType": {
    "import": 200,
    "scan": 100,
    "manual": 49
  },
  "classificationProgress": {
    "classified": 250,
    "unclassified": 99
  },
  "relationshipCoverage": {
    "withRelationships": 180,
    "orphans": 169
  }
}
```

---

### POST /api/linaw/classify — Batch Classification (N002)

Run AI code classification over ready library ordinances. Assigns Title/Chapter/Article positions.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "ordinanceIds": ["uuid-v4", "uuid-v4"]
}
```

- `ordinanceIds` (optional): If omitted, classifies the entire `ready` library.

**Response (200):**
```json
{
  "classified": 50,
  "skipped": 0,
  "results": [
    {
      "ordinanceId": "uuid-v4",
      "titleNumber": 3,
      "chapterNumber": 2,
      "articleNumber": 5,
      "aiSuggestion": "Title III - Finance, Chapter 2 - Appropriations",
      "confidence": 0.88
    }
  ]
}
```

---

### PUT /api/linaw/classify/:id — Classification Override (N002)

Override the AI-assigned code classification for a specific ordinance.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "titleNumber": 5,
  "chapterNumber": 1,
  "articleNumber": 3,
  "reason": "This ordinance deals with public works, not finance"
}
```

**Response (200):**
```json
{
  "ordinanceId": "uuid-v4",
  "titleNumber": 5,
  "chapterNumber": 1,
  "articleNumber": 3,
  "humanOverride": "Title V - Public Works",
  "reviewedBy": "user-uuid"
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_BODY` | Missing required fields |
| 404 | `NOT_FOUND` | Ordinance not found |
| 409 | `CONFLICT` | Ordinance not in eligible status |

---

### POST /api/linaw/detect-relationships — Cross-Reference + Conflict Detection (N003/N004)

Run cross-reference scanning and conflict detection in a single pipeline. Returns both relationships and conflicts.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "ordinanceIds": ["uuid-v4", "uuid-v4"]
}
```

- `ordinanceIds` (optional): If omitted, scans the entire library.

**Response (200):**
```json
{
  "pipelineId": "detect-uuid-v4",
  "scanned": 349,
  "relationshipsDetected": 45,
  "relationshipsPersisted": 42,
  "skippedExisting": 3,
  "orphans": 169,
  "conflictsDetected": 8,
  "conflictsPersisted": 8,
  "conflicts": [
    {
      "id": "uuid-v4",
      "ordinanceAId": "uuid-v4",
      "ordinanceBId": "uuid-v4",
      "reason": "Section 5 of Ord. 2024-015 contradicts Section 3 of Ord. 2019-042 regarding tax rates",
      "confidence": 0.92,
      "excerpts": [
        {
          "ordinanceId": "uuid-v4",
          "passage": "The tax rate shall be 5%..."
        },
        {
          "ordinanceId": "uuid-v4",
          "passage": "The tax rate shall be 3%..."
        }
      ]
    }
  ],
  "hitlRequired": true,
  "exceptions": []
}
```

---

### GET /api/linaw/conflicts — Conflict List (N004)

List all detected conflicts with evidence excerpts.

**Auth:** `withUserAuth`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (min 1) |
| `limit` | integer | `20` | Items per page (1-100) |

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid-v4",
      "ordinanceAId": "uuid-v4",
      "ordinanceBId": "uuid-v4",
      "reason": "Contradictory tax rate provisions",
      "confidence": 0.92,
      "excerpts": [
        { "ordinanceId": "uuid-v4", "passage": "The tax rate shall be 5%..." },
        { "ordinanceId": "uuid-v4", "passage": "The tax rate shall be 3%..." }
      ],
      "confirmed": 0,
      "createdAt": "2026-08-09T10:00:00",
      "ordinanceA": {
        "id": "uuid-v4",
        "ordinanceNumber": 15,
        "seriesYear": 2024,
        "title": "Tax Code Amendment"
      },
      "ordinanceB": {
        "id": "uuid-v4",
        "ordinanceNumber": 42,
        "seriesYear": 2019,
        "title": "Revenue Code"
      }
    }
  ],
  "total": 8,
  "page": 1,
  "limit": 20
}
```

---

### POST /api/linaw/assemble — Code Assembly (N006)

Assemble classified, confirmed ordinances into a municipal code volume with table of contents.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "edition": "2026 Edition"
}
```

- `edition` (required): Non-empty string identifying the code edition.

**Response (200):**
```json
{
  "codeVolumeId": "uuid-v4",
  "edition": "2026 Edition",
  "status": "draft",
  "toc": [
    {
      "titleNumber": 1,
      "titleName": "General Provisions",
      "chapters": [
        {
          "chapterNumber": 1,
          "chapterName": "Definitions",
          "articles": [
            {
              "articleNumber": 1,
              "ordinanceId": "uuid-v4",
              "ordinanceNumber": 1,
              "seriesYear": 1989
            }
          ]
        }
      ]
    }
  ],
  "totalTitles": 20,
  "totalChapters": 85,
  "totalArticles": 312,
  "generatedAt": "2026-08-09T12:00:00"
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION` | edition must be a non-empty string |
| 409 | `PENDING_RELATIONSHIPS` | Unconfirmed relationships exist (HITL required) |
| 409 | `NOTHING_TO_ASSEMBLE` | No eligible ordinances to assemble |

---

### GET /api/linaw/code — Code Volume List (N006)

List all generated code volumes (newest first, max 100).

**Auth:** `withUserAuth`

**Response (200):**
```json
{
  "items": [
    {
      "id": "uuid-v4",
      "title": "Municipal Code of Pitogo",
      "edition": "2026 Edition",
      "status": "draft",
      "createdAt": "2026-08-09T12:00:00"
    }
  ],
  "total": 1
}
```

---

### GET /api/linaw/code/:id — Code Volume Detail (N006)

Retrieve full table of contents for a specific code volume.

**Auth:** `withUserAuth`

**Response (200):**
```json
{
  "id": "uuid-v4",
  "title": "Municipal Code of Pitogo",
  "edition": "2026 Edition",
  "status": "draft",
  "toc": [
    {
      "titleNumber": 1,
      "titleName": "General Provisions",
      "chapters": [...]
    }
  ],
  "generatedById": "uuid-v4",
  "generatedAt": "2026-08-09T12:00:00",
  "publishedAt": null,
  "createdAt": "2026-08-09T12:00:00"
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 404 | `NOT_FOUND` | Code volume not found |

---

### POST /api/linaw/export-package — L1 Interchange Export (N015)

Export LINAW's classified library as an L1 interchange package.

**Auth:** `withUserAuth`  
**Content-Type:** `application/json`

**Request:**
```json
{
  "ordinanceIds": ["uuid-v4", "uuid-v4"]
}
```

- `ordinanceIds` (optional): If omitted, exports all ready ordinances.

**Response (200):**
```
Content-Type: application/json
Content-Disposition: attachment; filename="pillar-linaw-l1-package-2026-08-09T12-00-00-000Z.json"

{
  "manifest": {
    "format": "l1-interchange",
    "version": "1.0.0",
    "source": {
      "module": "linaw",
      "recordCount": 50
    },
    "exportedAt": "2026-08-09T12:00:00.000Z"
  },
  "packageHash": "sha256-hex",
  "records": [...]
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_BODY` | Invalid ordinanceIds format |
| 409 | `CONFLICT` | Records not eligible |

---

## Auth API Endpoints

### POST /api/auth/user/login — User Login

Authenticate an LGU user and create a session.

**Content-Type:** `application/json`

**Request:**
```json
{
  "email": "maria@pitogo.gov.ph",
  "password": "secure-password"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid-v4",
    "email": "maria@pitogo.gov.ph",
    "full_name": "Maria Santos",
    "lgu_name": "Municipality of Pitogo",
    "province": "Quezon"
  }
}
```

Sets `pillar_user_session` cookie on success.

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 401 | `INVALID_CREDENTIALS` | Wrong email/password |
| 403 | `ACCOUNT_PENDING` | Account awaiting admin approval |
| 403 | `ACCOUNT_REJECTED` | Account was rejected by admin |
| 403 | `ACCOUNT_INACTIVE` | Account has been deactivated |

---

### POST /api/auth/user/logout — User Logout

Destroy the current user session.

**Auth:** Session cookie required

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

Clears `pillar_user_session` cookie.

---

### GET /api/auth/user/me — Session Check

Validate the current user session and return user info.

**Auth:** Session cookie required

**Response (200):**
```json
{
  "user": {
    "id": "uuid-v4",
    "email": "maria@pitogo.gov.ph",
    "full_name": "Maria Santos",
    "lgu_name": "Municipality of Pitogo",
    "province": "Quezon"
  }
}
```

**Error Responses:**
| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | No valid session |

---

### POST /api/auth/login — Admin Login

Authenticate an admin user and create an admin session.

**Content-Type:** `application/json`

**Request:**
```json
{
  "username": "admin",
  "password": "admin-password"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid-v4",
    "username": "admin",
    "display_name": "Super Admin",
    "role": "super_admin"
  }
}
```

Sets `pillar_session` cookie on success.

---

### POST /api/auth/logout — Admin Logout

Destroy the current admin session.

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

### GET /api/auth/me — Admin Session Check

Validate the current admin session.

**Response (200):**
```json
{
  "user": {
    "id": "uuid-v4",
    "username": "admin",
    "display_name": "Super Admin",
    "role": "super_admin",
    "lgu_id": null,
    "province_id": null
  }
}
```

---

### POST /api/auth/register — Admin User Registration

Register a new admin user (requires super_admin session).

**Auth:** `withAuth` (super_admin required)

---

## Health Endpoint

### GET /api/health — System Health

Check system health without authentication.

**Auth:** None (public)

**Response (200):**
```json
{
  "status": "ok",
  "service": "pillar",
  "modules": ["ella", "obra", "yala"],
  "lightrag": "healthy",
  "timestamp": "2026-08-09T12:00:00.000Z"
}
```

---

## Error Codes & Response Shapes

### Standard Error Response

All errors follow a consistent shape:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

### Error Code Reference

| HTTP Status | Code | Meaning |
|-------------|------|---------|
| 400 | `INVALID_BODY` | Malformed or missing request body |
| 400 | `VALIDATION` | Business validation failure |
| 400 | `NO_FILES` | No files in upload request |
| 400 | `TOO_MANY_FILES` | Batch exceeds file limit |
| 400 | `FILE_TOO_LARGE` | File exceeds size limit |
| 400 | `UNSUPPORTED_TYPE` | Invalid file MIME type |
| 400 | `UNSUPPORTED_FORMAT` | Invalid import format |
| 400 | `INVALID_PAYLOAD` | Malformed import data |
| 400 | `NO_RECORDS` | Empty import batch |
| 400 | `TOO_MANY_RECORDS` | Import exceeds record limit |
| 401 | `UNAUTHORIZED` | Missing or invalid session |
| 401 | `INVALID_CREDENTIALS` | Wrong login credentials |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `ACCOUNT_PENDING` | User awaiting approval |
| 403 | `ACCOUNT_REJECTED` | User account rejected |
| 403 | `ACCOUNT_INACTIVE` | User account deactivated |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Resource state conflict |
| 409 | `PENDING_RELATIONSHIPS` | Unconfirmed relationships block assembly |
| 409 | `NOTHING_TO_ASSEMBLE` | No eligible records for assembly |
| 500 | — | Internal server error (unstructured) |

---

## Database Schema

### LIKHA Tables

#### `archived_ordinances`
Primary table for LIKHA's digitized ordinance archive.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `ordinance_number` | INTEGER | NOT NULL, UNIQUE with series_year | Ordinance number |
| `series_year` | INTEGER | NOT NULL, UNIQUE with ordinance_number | Year of enactment |
| `title` | TEXT | NOT NULL | Ordinance title |
| `content` | TEXT | NOT NULL | Full extracted text |
| `summary` | TEXT | — | AI-generated summary |
| `subject_tags` | TEXT | DEFAULT '[]' | JSON array of subject tags |
| `status` | TEXT | DEFAULT 'active' | Legal status: active/amended/repealed/superseded/expired |
| `source_type` | TEXT | DEFAULT 'scan' | Origin: scan |
| `original_filename` | TEXT | — | Original upload filename |
| `scan_file_path` | TEXT | — | Path to stored scan file |
| `file_hash` | TEXT | — | SHA-256 hash of uploaded file |
| `archive_status` | TEXT | DEFAULT 'processing' | Workflow status: processing/pending_review/published/flagged |
| `uploaded_by_id` | TEXT | NOT NULL, FK → users(id) | Uploader user ID |
| `verified_by_id` | TEXT | FK → users(id) | Human verifier user ID |
| `extraction_confidence` | TEXT | — | JSON: per-field AI confidence scores |
| `section_count` | INTEGER | — | Number of sections detected |
| `rejection_reason` | TEXT | — | Reason for rejection (if flagged) |
| `dilg_submitted` | INTEGER | DEFAULT 0 | DILG export flag |
| `dilg_submitted_at` | TEXT | — | DILG export timestamp |
| `created_at` | TEXT | DEFAULT datetime('now') | Creation timestamp |
| `updated_at` | TEXT | DEFAULT datetime('now') | Last update timestamp |

#### `classifications`
AI and human-assigned subject classifications for LIKHA records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `ordinance_id` | TEXT | NOT NULL, FK → archived_ordinances(id) | Parent ordinance |
| `category` | TEXT | NOT NULL | Subject category |
| `confidence` | REAL | — | AI confidence (NULL for human overrides) |
| `assigned_by` | TEXT | NOT NULL | Assigner (agent or user ID) |
| `created_at` | TEXT | DEFAULT datetime('now') | Assignment timestamp |

#### `amendment_links`
Detected amendment/repeal relationships between LIKHA ordinances.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `amending_id` | TEXT | NOT NULL, FK → archived_ordinances(id) | Source ordinance |
| `amended_id` | TEXT | NOT NULL, FK → archived_ordinances(id) | Target ordinance |
| `relationship_type` | TEXT | NOT NULL | Type: amend/repeal/reference |
| `detected_by` | TEXT | NOT NULL | Detection source |
| `confirmed` | INTEGER | DEFAULT 0 | Human confirmation flag |
| `created_at` | TEXT | DEFAULT datetime('now') | Detection timestamp |

---

### LINAW Tables

#### `linaw_ordinances`
Primary table for LINAW's ordinance library.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `ordinance_number` | INTEGER | NOT NULL, UNIQUE with series_year | Ordinance number |
| `series_year` | INTEGER | NOT NULL, UNIQUE with ordinance_number | Year of enactment |
| `title` | TEXT | NOT NULL | Ordinance title |
| `content` | TEXT | NOT NULL | Full text |
| `summary` | TEXT | — | AI-generated summary |
| `subject_tags` | TEXT | DEFAULT '[]' | JSON array of subject tags |
| `status` | TEXT | DEFAULT 'active' | Legal status |
| `source_type` | TEXT | DEFAULT 'manual' | Origin: scan/import/manual |
| `source_filename` | TEXT | — | Original filename |
| `file_hash` | TEXT | — | SHA-256 hash |
| `library_status` | TEXT | DEFAULT 'pending_review' | Workflow: processing/pending_review/ready/rejected |
| `uploaded_by_id` | TEXT | NOT NULL, FK → users(id) | Uploader |
| `verified_by_id` | TEXT | FK → users(id) | Verifier |
| `created_at` | TEXT | DEFAULT datetime('now') | Creation timestamp |
| `updated_at` | TEXT | DEFAULT datetime('now') | Last update timestamp |

#### `codification_records`
Code classification positions for LINAW ordinances.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `ordinance_id` | TEXT | NOT NULL, UNIQUE, FK → linaw_ordinances(id) | Parent ordinance |
| `title_number` | INTEGER | — | Code title number |
| `chapter_number` | INTEGER | — | Code chapter number |
| `article_number` | INTEGER | — | Code article number |
| `section_in_code` | INTEGER | — | Section position in code |
| `cod_status` | TEXT | DEFAULT 'unclassified' | Status: unclassified/classified/reviewed/approved/codified |
| `ai_suggestion` | TEXT | — | AI-assigned classification |
| `human_override` | TEXT | — | Human override (with reason) |
| `reviewed_by_id` | TEXT | FK → users(id) | Reviewer |
| `approved_by_id` | TEXT | FK → users(id) | Approver |
| `approved_at` | TEXT | — | Approval timestamp |
| `created_at` | TEXT | DEFAULT datetime('now') | Creation timestamp |
| `updated_at` | TEXT | DEFAULT datetime('now') | Last update timestamp |

#### `ordinance_relationships`
Cross-references and conflicts between LINAW ordinances.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `source_id` | TEXT | NOT NULL, FK → linaw_ordinances(id) | Source ordinance |
| `target_id` | TEXT | NOT NULL, FK → linaw_ordinances(id) | Target ordinance |
| `relationship_type` | TEXT | NOT NULL | Type: amendment/repeal/reference/conflict |
| `section_ref` | TEXT | — | JSON: evidence excerpts and reason |
| `confidence` | REAL | NOT NULL | Detection confidence |
| `confirmed` | INTEGER | DEFAULT 0 | Human confirmation flag |
| `rejected` | INTEGER | DEFAULT 0 | Human rejection flag |
| `confirmed_by_id` | TEXT | FK → users(id) | Confirmer/rejecter |
| `created_at` | TEXT | DEFAULT datetime('now') | Detection timestamp |

#### `code_volumes`
Generated municipal code volumes.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `title` | TEXT | NOT NULL | Volume title |
| `edition` | TEXT | NOT NULL | Edition identifier |
| `status` | TEXT | DEFAULT 'draft' | Status: draft/under_review/published |
| `structure` | TEXT | NOT NULL | JSON: table of contents tree |
| `generated_at` | TEXT | — | Generation timestamp |
| `published_at` | TEXT | — | Publication timestamp |
| `generated_by_id` | TEXT | FK → users(id) | Generator user |
| `created_at` | TEXT | DEFAULT datetime('now') | Creation timestamp |
| `updated_at` | TEXT | DEFAULT datetime('now') | Last update timestamp |

---

### Shared Tables

#### `agent_decisions`
Audit trail for all AI agent actions across both modules.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `module` | TEXT | NOT NULL | Module: 'likha' or 'linaw' |
| `pipeline_id` | TEXT | NOT NULL | Pipeline/batch identifier |
| `agent_id` | INTEGER | NOT NULL | Agent sequence number |
| `agent_name` | TEXT | NOT NULL | Agent name (Ingestor, OCR, Parser, etc.) |
| `action` | TEXT | NOT NULL | Action: start/complete/error |
| `input_snapshot` | TEXT | — | JSON: input state |
| `output_snapshot` | TEXT | — | JSON: output state |
| `confidence` | REAL | — | Agent confidence |
| `user_id` | TEXT | — | Associated user |
| `reason` | TEXT | — | Decision reason |
| `created_at` | TEXT | DEFAULT datetime('now') | Timestamp |

---

## Data Flow Diagrams

### LIKHA Pipeline (Upload → Publish)

```
User uploads files (1-10)
        |
        v
  [POST /api/likha/upload]
        |
        +-- SHA-256 hash each file
        +-- Check for duplicates (file_hash)
        +-- Write to data/uploads/likha/
        +-- Insert archived_ordinances (archive_status='processing')
        +-- Record agent_decision (Ingestor: start → complete)
        |
        v
  [POST /api/likha/pipeline]
        |
        +-- Agent 2 (OCR): Gemini/Qwen extracts text
        +-- Agent 3 (Parser): Extracts metadata (ordinance#, year, title)
        +-- Updates archived_ordinances with extracted data
        +-- Sets archive_status='pending_review'
        +-- Records extraction_confidence per field
        |
        v
  [PUT /api/likha/archive/:id] — Human Verification
        |
        +-- approve → Agent 6 (Archiver) runs → archive_status='published'
        |               → BM25 index updated
        +-- edit    → Corrections saved → then Archiver runs
        +-- reject  → archive_status='flagged', rejection_reason saved
        |
        v
  [GET /api/likha/archive?q=...] — BM25 Search
        |
        +-- Self-healing index rebuild if empty
        +-- Returns ranked results with <mark> snippets
```

### LINAW Pipeline (Import → Codify)

```
User imports ordinances (JSON/CSV/DOCX)
        |
        v
  [POST /api/linaw/import]
        |
        +-- Parse payload (format detection)
        +-- Validate per record
        +-- Insert linaw_ordinances (library_status='pending_review')
        +-- Single transaction (all-or-nothing per record)
        |
        v
  [PUT /api/linaw/library/:id] — Human Verification
        |
        +-- approve → library_status='ready'
        +-- reject  → library_status='rejected'
        +-- edit    → Corrections saved → approve
        |
        v
  [POST /api/linaw/classify] — AI Code Classification
        |
        +-- Agent 2: Assigns Title/Chapter/Article
        +-- Creates codification_records
        +-- Human can override via PUT /api/linaw/classify/:id
        |
        v
  [POST /api/linaw/detect-relationships] — Cross-Ref + Conflicts
        |
        +-- Agent 3: Scan cross-references (amendments, repeals)
        +-- Agent 4: Detect conflicts (contradictory provisions)
        +-- Insert ordinance_relationships (confirmed=0)
        +-- Human confirms/rejects each relationship
        |
        v
  [POST /api/linaw/assemble] — Code Assembly
        |
        +-- Gate: All relationships must be confirmed/rejected
        +-- Agent 5+6: Build TOC from classified ordinances
        +-- Insert code_volumes (status='draft')
        +-- Returns full table of contents
```

### L1 Interchange (LIKHA → LINAW)

```
  [LIKHA Module]                          [LINAW Module]
        |                                       ^
        v                                       |
  POST /api/likha/export-package         POST /api/linaw/import
        |                                       |
        +-- Build L1 JSON package               +-- Parse L1 JSON
        +-- Include manifest + records          +-- Insert into linaw_ordinances
        +-- SHA-256 package hash                +-- Report duplicates
        |                                       |
        +------- JSON attachment ---------------+
```

---

*Generated from source code at commit HEAD. Last updated: 2026-08-09.*
