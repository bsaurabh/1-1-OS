# Infrastructure Design — Unit 3: Meeting Ingestion

**Date**: 2026-03-02
**Unit**: Unit 3: Meeting Ingestion
**Stories**: US-05, US-06, US-07, US-08, US-17

---

## Infrastructure Overview

Unit 3 extends the two-tier infrastructure (Vercel + Supabase PostgreSQL) from Units 1–2 with four significant additions: OpenAI Whisper API (transcription), Supabase Storage (transient audio), browser push notifications (web-push VAPID), and the fully-wired Vercel cron handler for async AI analysis.

```
Developer / Browser
      |
      v
  Vercel Edge Network (CDN + routing)
      |
      |-- Static assets (.next/static/) ──────────────────────── Vercel CDN
      |
      |-- SSR page requests (/teammates/*, /)
      |       --> Vercel Serverless Function (Next.js server runtime)
      |               --> Supabase PostgreSQL (Prisma + PgBouncer)
      |
      |-- API requests (ingestion, transcription, commitments, notifications)
      |       --> Vercel Serverless Function (Next.js API route)
      |               |-- Supabase PostgreSQL  (meeting + job + commitment CRUD)
      |               |-- Supabase Storage     (audio presigned URL, download, delete) [NEW]
      |               |-- OpenAI Whisper API   (audio transcription)                   [NEW]
      |               |-- Anthropic Claude API (meeting analysis — via cron)           [NEW]
      |               |-- Resend               (email notifications)
      |               |-- web-push VAPID       (browser push)                          [NEW]
      |
      |-- Vercel Cron (every 30s)
              --> GET /api/jobs/process-analysis (60s max)
                      --> Supabase PostgreSQL (atomic job claim + updates)
                      --> Anthropic Claude API (Sonnet meeting analysis)
                      --> Supabase PostgreSQL (write analysis results)
                      --> web-push + Resend   (notifications — best-effort)
```

---

## 1. Compute: Vercel Serverless Functions

### New Route-to-Function Mapping (Unit 3)

| Route | Function File | Max Duration | Body Parser | Notes |
|-------|--------------|-------------|------------|-------|
| `POST /api/meetings/[id]/paste` | `pages/api/meetings/[id]/paste.ts` | 10s | default | Validate + DB write |
| `POST /api/meetings/[id]/upload` | `pages/api/meetings/[id]/upload.ts` | 10s | **disabled** | formidable multipart; extract + DB write |
| `POST /api/meetings/[id]/save-transcription` | `pages/api/meetings/[id]/save-transcription.ts` | 10s | default | Validate + DB write |
| `GET /api/transcription/start` | `pages/api/transcription/start.ts` | 10s | default | Generate presigned URL |
| `POST /api/transcription/transcribe` | `pages/api/transcription/transcribe.ts` | **60s** | default | Download + Whisper + delete |
| `DELETE /api/transcription/[fileId]` | `pages/api/transcription/[fileId].ts` | 10s | default | Delete audio from storage |
| `GET /api/meetings/[id]/[meetingId]` | `pages/api/meetings/[id]/[meetingId].ts` | 10s | default | Poll for analysis status |
| `GET /api/commitments/[teammateId]` | `pages/api/commitments/[teammateId].ts` | 10s | default | List SUGGESTED commitments |
| `PATCH /api/commitments/[id]` | `pages/api/commitments/[id].ts` | 10s | default | Confirm / dismiss |
| `POST /api/notifications/subscribe` | `pages/api/notifications/subscribe.ts` | 10s | default | Upsert push subscription |
| `DELETE /api/notifications/subscribe` | `pages/api/notifications/subscribe.ts` | 10s | default | Remove push subscription |
| `GET /api/jobs/process-analysis` | `pages/api/jobs/process-analysis.ts` | **60s** | default | Cron: claim job + analyse + notify |
| `GET /teammates/[id]/meeting/[meetingId]` | SSR page function | 10s | N/A | Meeting results page (SSR) |

### Extended Timeout Configuration

Two routes require `maxDuration: 60` beyond the Vercel default (10s):

```typescript
// pages/api/transcription/transcribe.ts
export const config = {
  maxDuration: 60,   // Whisper API: up to 30s for long recordings
}

// pages/api/jobs/process-analysis.ts
export const config = {
  maxDuration: 60,   // Claude Sonnet analysis (~30s) + job claim + persist + notify
}
```

### Body Parser Disabled (File Upload Route)

```typescript
// pages/api/meetings/[id]/upload.ts
export const config = {
  api: {
    bodyParser: false,   // REQUIRED: allows formidable to parse the multipart stream
  },
}
```

### Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/jobs/process-analysis",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

> **Note**: Vercel Hobby minimum cron interval is 1 minute (`*/1 * * * *`). The functional design targets 30-second intervals — achievable on Vercel Pro (`*/30 * * * * *` cron syntax). For PoC/Hobby, 1-minute intervals are used. The cron is secured via `CRON_SECRET` header validation (Unit 1 pattern).

### Inherited Constraints (unchanged)

- No persistent memory between invocations (stateless)
- Cold start: ~200–400ms
- Memory: 1792MB per function (sufficient — 10MB file buffer + parsing overhead well within limits)

---

## 2. External Service: OpenAI Whisper API

**Service**: OpenAI API (`api.openai.com`)
**Access**: HTTPS REST, authenticated via `Authorization: Bearer` header (managed by `openai` npm SDK)

### Endpoint Usage

| Endpoint | Used By | Model | Estimated Latency |
|----------|---------|-------|------------------|
| `POST /v1/audio/transcriptions` | `transcribeAudio()` in `lib/transcription.ts` | `whisper-1` | 5–30s (audio length–dependent) |

### API Key Management

| Environment | Storage Location | Access |
|------------|-----------------|--------|
| Development | `.env.local` → `OPENAI_API_KEY` | Local Next.js dev server only |
| Production | Vercel Environment Variables → `OPENAI_API_KEY` | Vercel serverless runtime only |

**Key isolation**: `OPENAI_API_KEY` is server-side only. Never use `NEXT_PUBLIC_` prefix.

### Audio Format

- Client uploads `audio/webm` or `audio/mp4` (browser `MediaRecorder` output)
- Both formats accepted by `whisper-1` without conversion
- Maximum file size: 25MB (Whisper limit) — server accepts up to this limit for audio (no explicit cap beyond Whisper's own)

### Retry Behaviour

- No in-request retry for Whisper (unlike Claude). A Whisper failure surfaces directly as a `TranscriptionError` to the client
- Client can retry by clicking "Try Again" (resets `VoiceRecorder` state to `IDLE`)
- Audio file remains in Supabase Storage until explicit discard or successful transcription

---

## 3. External Service: Anthropic Claude API (Meeting Analysis)

**Service**: Anthropic Claude API (`api.anthropic.com`)
**Already present from Unit 2** — extended with meeting analysis usage.

### Additional Endpoint Usage (Unit 3)

| Endpoint | Used By | Model | Max Tokens | Estimated Latency |
|----------|---------|-------|------------|------------------|
| `POST /v1/messages` | `analyze()` in `handlers/meetingAnalysisHandler.ts` | `claude-sonnet-4-6` | 2048 | ~15–40s |

### Retry Behaviour (Unit 3 Addition)

Unit 3 adds a **cron-based outer retry layer** on top of the Unit 2 `callClaudeWithRetry` (inner):

```
Cron invocation → callClaudeWithRetry (inner: 1 retry, 1s delay)
    success → mark COMPLETE
    failure → handleFailure (outer: increment retryCount up to 2)
              → next cron tick picks it up again
```

---

## 4. New Infrastructure: Supabase Storage

**Service**: Supabase Storage (`{project}.supabase.co/storage/v1`)
**Bucket**: `voice-recordings` (private — no public read access)
**Access**: `@supabase/supabase-js` SDK with `SUPABASE_SERVICE_ROLE_KEY`

### Bucket Configuration

| Setting | Value |
|---------|-------|
| Bucket name | `voice-recordings` |
| Public | No (private) |
| File size limit | No bucket-level limit (enforced by Whisper's 25MB limit) |
| Allowed MIME types | `audio/webm`, `audio/mp4` |
| File lifecycle | Deleted immediately after transcription or discard |

### Operations

| Operation | API Call | Used By |
|-----------|----------|---------|
| Generate presigned upload URL | `storage.createSignedUploadUrl(path)` | `GET /api/transcription/start` |
| Client direct upload | `PUT {signedUploadUrl}` (browser → Supabase, not via Next.js) | VoiceRecorder component |
| Download for transcription | `storage.download(path)` | `POST /api/transcription/transcribe` |
| Delete after transcription | `storage.remove([path])` | `POST /api/transcription/transcribe` |
| Delete on discard | `storage.remove([path])` | `DELETE /api/transcription/[fileId]` |

### Path Convention

```
bucket: voice-recordings
path:   {managerId}/{fileId}

Example: voice-recordings/clxyz123.../clabc456...
                         ^^^^^^^^^^^  ^^^^^^^^^^^^^
                         managerId    fileId (cuid, server-generated)
                         (from JWT,   (never user-controlled)
                         not user input)
```

### Key Management

| Variable | Exposure | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | Server-side only | Supabase project URL for Storage client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only | Full storage access; bypasses RLS |

> **Note**: `SUPABASE_SERVICE_ROLE_KEY` grants full access to all Supabase services. It must never be included in client-side code or `NEXT_PUBLIC_` variables.

---

## 5. New Infrastructure: Browser Push Notifications (web-push VAPID)

**Library**: `web-push` npm package
**Protocol**: W3C Web Push Protocol with VAPID (Voluntary Application Server Identification)
**Push services**: Google FCM (Chrome), Mozilla Push Service (Firefox) — handled transparently by the browser

### VAPID Key Management

| Variable | Exposure | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client bundle (safe — public key by design) | Browser `pushManager.subscribe({ applicationServerKey })` |
| `VAPID_PRIVATE_KEY` | Server-side only | Sign push notification requests |
| `VAPID_SUBJECT` | Server-side only | Contact email for push service (`mailto:admin@example.com`) |

### One-Time Setup

```bash
# Generate VAPID key pair (run once per project)
node -e "const wp = require('web-push'); const keys = wp.generateVAPIDKeys(); console.log(JSON.stringify(keys, null, 2))"

# Output:
# {
#   "publicKey": "BExamplePublicKeyBase64UrlEncoded...",
#   "privateKey": "ExamplePrivateKeyBase64UrlEncoded..."
# }
```

Copy `publicKey` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.local` and Vercel dashboard.
Copy `privateKey` → `VAPID_PRIVATE_KEY` in `.env.local` and Vercel dashboard.

### Push Notification Flow

```
Browser (client)                     Vercel                        Push Service
     |                                   |                              |
     |  pushManager.subscribe({          |                              |
     |    applicationServerKey:          |                              |
     |    NEXT_PUBLIC_VAPID_PUBLIC_KEY   |                              |
     |  })                               |                              |
     |  → PushSubscription object        |                              |
     |                                   |                              |
     |-- POST /api/notifications/subscribe -->                          |
     |   { subscription: PushSubscription }                            |
     |                            store in DB (upsert)                  |
     |<-- 200 OK ------------------|                                    |
     |                                   |                              |
     |   [later — cron analysis completes]                              |
     |                                   |                              |
     |                       webPush.sendNotification(                  |
     |                         pushSub, payload,                        |
     |                         vapidDetails: { subject, publicKey,     |
     |                                         privateKey }            |
     |                       )                                          |
     |                                   |-- POST to push service URL ->|
     |                                   |                              |
     |<-- Push notification displayed ---|<-- 201 Created -------------|
```

### Notification Storage

Push subscriptions are stored in the `push_subscriptions` table (Unit 1 schema):
```sql
-- One row per manager (upsert semantics)
push_subscriptions (id, managerId, subscription Json, createdAt)
```

---

## 6. Database: Supabase PostgreSQL

### New Tables Used in Unit 3

| Table | Source | Operations |
|-------|--------|-----------|
| `meetings` | Unit 1 schema | INSERT (ingestion), SELECT (poll/results), UPDATE (analysis complete/failed) |
| `analysis_jobs` | Unit 1 schema | INSERT (enqueue), UPDATE (claim/complete/fail), SELECT (claim query) |
| `commitments` | Unit 1 schema | INSERT (saveSuggested), UPDATE (confirm), DELETE (dismiss), SELECT (list) |
| `push_subscriptions` | Unit 1 schema | UPSERT (subscribe), DELETE (unsubscribe) |

### DB Migration Required (Unit 3)

The `analysis_jobs` table in the Unit 1 schema does not include a `retryCount` column. Unit 3 requires:

```sql
-- Prisma migration file: prisma/migrations/{timestamp}_add_retry_count_to_analysis_jobs/migration.sql
ALTER TABLE analysis_jobs ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
```

**Prisma schema change** (`prisma/schema.prisma`):
```prisma
model AnalysisJob {
  id          String    @id @default(cuid())
  meetingId   String    @unique
  status      JobStatus @default(PENDING)
  retryCount  Int       @default(0)    // ← NEW FIELD
  error       String?
  createdAt   DateTime  @default(now())
  processedAt DateTime?
  meeting     Meeting   @relation(fields: [meetingId], references: [id])
  @@map("analysis_jobs")
}
```

**Migration command**:
```bash
npx prisma migrate dev --name add_retry_count_to_analysis_jobs
```

### Connection Routing (unchanged from Unit 1)

```
Vercel Function
  └─ Prisma Client
        ├─ DATABASE_URL (port 6543) ──── PgBouncer ──── PostgreSQL   (runtime queries)
        └─ DIRECT_URL   (port 5432) ───────────────────  PostgreSQL  (migrations only)
```

### Raw SQL Note

`AnalysisJobQueue.claimNextJob()` uses `prisma.$queryRaw` for `FOR UPDATE SKIP LOCKED`. Prisma's type-safe query builder does not support this construct. The raw SQL is isolated to `lib/analysisQueue.ts`.

---

## 7. Environment Variables (Complete After Unit 3)

### Full `.env.local`

```bash
# Unit 1
DATABASE_URL=postgresql://[user]:[password]@[host]:6543/[db]?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://[user]:[password]@[host]:5432/[db]
SECRET_KEY=local-dev-secret-key-32chars-min!!
RESEND_API_KEY=re_placeholder
CRON_SECRET=local-cron-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Unit 2
ANTHROPIC_API_KEY=sk-ant-...

# Unit 3 (new)
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BExamplePublicKeyBase64UrlEncoded...
VAPID_PRIVATE_KEY=ExamplePrivateKeyBase64UrlEncoded...
VAPID_SUBJECT=mailto:admin@example.com
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Vercel Production Variables (Unit 3 Additions)

Add in Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Environments | Notes |
|----------|-------------|-------|
| `OPENAI_API_KEY` | Production, Preview | OpenAI API key for Whisper |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Production, Preview | Public key — safe to expose |
| `VAPID_PRIVATE_KEY` | Production, Preview | Private key — server only |
| `VAPID_SUBJECT` | Production, Preview | e.g. `mailto:admin@yourapp.com` |
| `SUPABASE_URL` | Production, Preview | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Production, Preview | Service role — server only |

---

## 8. Security Boundary Diagram

```
┌──────────────────────────────────────────────────────────┐
│  Browser (Public)                                        │
│  - React UI (VoiceRecorder, MeetingInputModal, etc.)     │
│  - VoiceRecorder state machine (client memory)          │
│  - JWT session cookie (httpOnly, not readable)           │
│  - NEXT_PUBLIC_VAPID_PUBLIC_KEY (safe — public by design)│
│  - PushSubscription object (browser-managed)            │
└──────────────────┬───────────────────────────────────────┘
                   │ HTTPS
┌──────────────────▼───────────────────────────────────────┐
│  Vercel Serverless Functions (Trusted)                   │
│  - withAuth validates JWT → managerId                    │
│  - managerId from session ONLY (never user input)        │
│  - ANTHROPIC_API_KEY (env, not in bundle)                │
│  - OPENAI_API_KEY (env, not in bundle)                   │
│  - VAPID_PRIVATE_KEY (env, not in bundle)                │
│  - SUPABASE_SERVICE_ROLE_KEY (env, not in bundle)        │
│  - File validation: MIME + extension + formidable limit  │
│  - Storage path: {managerId}/{fileId} (session-derived)  │
└──────┬──────────┬─────────────┬───────────┬─────────────┘
       │Prisma    │Supabase SDK │openai SDK │@anthropic-ai
       │(TLS)     │(HTTPS)      │(HTTPS)    │(HTTPS)
┌──────▼──────┐ ┌──────▼──────┐ ┌───▼────┐ ┌──────▼─────┐
│Supabase     │ │Supabase     │ │OpenAI  │ │Anthropic   │
│PostgreSQL   │ │Storage      │ │Whisper │ │Claude      │
│(RLS + PKs)  │ │voice-record.│ │API     │ │Sonnet      │
│             │ │(private     │ │        │ │            │
│             │ │ bucket)     │ │        │ │            │
└─────────────┘ └─────────────┘ └────────┘ └────────────┘
      ↑ Notification path (separate)
┌─────────────────────────────────────────────────────────┐
│  Resend (email) + Browser Push Service (VAPID)          │
│  - Both called from Vercel functions (cron handler)     │
│  - Both failures swallowed (P-3.06)                     │
└─────────────────────────────────────────────────────────┘
```

---

## 9. Setup Checklists

### Local Development Setup (Unit 3 Additions)

**Supabase Storage**:
- [ ] In Supabase Dashboard → Storage → Create bucket `voice-recordings`
- [ ] Set bucket to **private** (no public access)
- [ ] Copy `SUPABASE_URL` from Supabase project settings → API
- [ ] Copy `SUPABASE_SERVICE_ROLE_KEY` from Supabase project settings → API → service_role key
- [ ] Add both to `.env.local`

**OpenAI**:
- [ ] Obtain OpenAI API key from `platform.openai.com`
- [ ] Add `OPENAI_API_KEY=sk-...` to `.env.local`

**VAPID Keys**:
- [ ] Generate VAPID key pair: `node -e "const wp = require('web-push'); console.log(JSON.stringify(wp.generateVAPIDKeys(), null, 2))"`
- [ ] Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>` to `.env.local`
- [ ] Add `VAPID_PRIVATE_KEY=<privateKey>` to `.env.local`
- [ ] Add `VAPID_SUBJECT=mailto:admin@example.com` to `.env.local`

**Database Migration**:
- [ ] Run `npx prisma migrate dev --name add_retry_count_to_analysis_jobs`
- [ ] Verify migration: `npx prisma studio` → confirm `analysis_jobs` has `retryCount` column

**Dependencies**:
- [ ] Run `npm install openai web-push mammoth pdf-parse formidable @supabase/supabase-js`
- [ ] Run `npm install --save-dev @types/web-push @types/pdf-parse`

**Restart**:
- [ ] Restart `npm run dev` after `.env.local` changes

### Vercel Production Setup (Unit 3 Additions)

- [ ] Add all 6 new environment variables in Vercel dashboard (see Section 7)
- [ ] Create `voice-recordings` bucket in production Supabase project (private)
- [ ] Run migration against production DB: `npx prisma migrate deploy` (or apply SQL manually)
- [ ] Update `vercel.json` with cron configuration (or use Vercel dashboard → Cron)
- [ ] Redeploy after adding environment variables
- [ ] Test cron endpoint: `curl -X GET https://yourapp.vercel.app/api/jobs/process-analysis -H "Authorization: Bearer $CRON_SECRET"`
- [ ] Submit a test meeting and verify: analysis job created → cron picks it up → analysis complete → push notification received

---

## 10. No New Long-Running Infrastructure

The following were considered and **not** introduced in Unit 3:

| Service | Decision | Reason |
|---------|----------|--------|
| Dedicated message queue (SQS/Redis) | Not needed | Vercel cron + `analysis_jobs` DB table provides sufficient async queue at PoC scale |
| Separate transcription microservice | Not needed | OpenAI Whisper API called directly from Next.js API route |
| CDN for audio files | Not needed | Audio files are transient (deleted after transcription) |
| Supabase Realtime | Not needed | Client polling (5s interval) is sufficient; WebSocket complexity not justified for PoC |
| Background worker process | Not needed | Vercel cron replaces the need for a dedicated worker |
