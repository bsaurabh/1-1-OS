# Tech Stack Decisions — Unit 3: Meeting Ingestion

**Date**: 2026-03-02
**Unit**: Unit 3: Meeting Ingestion

---

## New Dependencies (Unit 3 Additions)

### Runtime Dependencies

| Package | Version | Purpose | Decision Rationale |
|---------|---------|---------|-------------------|
| `openai` | `^4.x` | OpenAI Whisper API client for voice transcription | Official OpenAI SDK; ships own TypeScript types; same SDK exposes models/completions if needed later |
| `web-push` | `^3.x` | Browser push notifications (VAPID protocol) | Mature library; handles VAPID signing, payload encryption, and push service communication; widely adopted Node.js standard |
| `mammoth` | `^1.x` | Extract plain text from `.docx` files | Purpose-built .docx → text extractor; no native modules required; outputs clean text suitable for Claude analysis |
| `pdf-parse` | `^1.x` | Extract plain text from `.pdf` files | Lightweight PDF text extraction; pure JS (no native binary dependencies); handles typical meeting transcript PDFs |
| `formidable` | `^3.x` | Multipart/form-data parsing for file upload routes | Idiomatic Next.js Pages Router approach with `bodyParser: false`; in-memory file storage avoids disk writes in serverless; v3 ships own TypeScript types |
| `@supabase/supabase-js` | `^2.x` | Supabase Storage client (presigned URLs, download, delete) | Required for audio lifecycle management; Prisma does not handle Storage operations; official Supabase SDK |

### DevDependencies (Type Packages)

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/web-push` | `^3.x` | TypeScript types for `web-push` (does not ship own types) |
| `@types/pdf-parse` | `^1.x` | TypeScript types for `pdf-parse` (does not ship own types) |

**Note**: `formidable` v3+, `mammoth` v1.7+, `openai` npm, and `@supabase/supabase-js` ship their own TypeScript type definitions — no additional `@types/` packages required for these.

**Install command**:
```bash
npm install openai web-push mammoth pdf-parse formidable @supabase/supabase-js
npm install --save-dev @types/web-push @types/pdf-parse
```

---

## Model Selection

| Use Case | Model / API | Rationale |
|----------|------------|-----------|
| Voice transcription | OpenAI `whisper-1` | PRD-specified; industry-standard accuracy for meeting recordings; supports webm + mp4 (MediaRecorder output formats) |
| Meeting analysis | Anthropic `claude-sonnet-4-6` | Higher reasoning needed to extract structured themes/tags/tone/summary/commitments from free-form meeting notes; same model used for profile synthesis in Unit 2 |

**Model ID constants** (defined in handler files):
```typescript
// handlers/meetingAnalysisHandler.ts
const ANALYSIS_MODEL = 'claude-sonnet-4-6'

// handlers/transcriptionHandler.ts
const WHISPER_MODEL = 'whisper-1'
```

---

## OpenAI Client Usage Pattern

```typescript
import OpenAI from 'openai'
import { toFile } from 'openai'
import { createReadStream } from 'fs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Whisper transcription call
async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const file = await toFile(audioBuffer, 'recording.webm', { type: mimeType })
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: WHISPER_MODEL,
  })
  return transcription.text
}
```

**Singleton pattern**: `openai` client instantiated once per module scope (consistent with `anthropic` client in Unit 2).

---

## Anthropic Analysis Call Pattern

```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Single structured JSON call for meeting analysis
const message = await callClaudeWithRetry(() =>
  anthropic.messages.create({
    model: ANALYSIS_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: buildAnalysisPrompt(rawText, teammateName, profile) }],
  })
)

const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
const result = parseAnalysisResponse(responseText)
```

**Token budget**: `max_tokens: 2048` — analysis JSON response includes themes (2–5), tags (1–3), tone (phrase), summary (sentence), and commitments (0–N). 2048 tokens provides generous headroom for all fields.

**Retry**: Reuses `callClaudeWithRetry` from `lib/claude.ts` (defined in Unit 2) — single retry on transient errors. The cron job's `retryCount`-based retry is an additional outer layer for harder failures.

---

## Supabase Storage Client Pattern

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-side only — never expose to client
)

const BUCKET = 'voice-recordings'

// Generate presigned upload URL (called by GET /api/transcription/start)
async function createPresignedUploadUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

// Download audio for transcription
async function downloadFile(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error) throw new Error(error.message)
  return Buffer.from(await data.arrayBuffer())
}

// Delete audio after transcription or discard
async function deleteFile(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
  // Errors silently ignored — file may already be deleted
}
```

**Service role key**: Used only in server-side API routes. Never passed to client components or included in `NEXT_PUBLIC_` env vars.

---

## web-push Configuration Pattern

```typescript
import webPush from 'web-push'

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,            // e.g. 'mailto:admin@example.com'
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// Send push notification
async function sendPushNotification(subscription: PushSubscription, payload: object) {
  try {
    await webPush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err) {
    // Log and swallow — expired subscriptions (410) are common
    console.error('[push] notification failed:', err instanceof Error ? err.message : err)
  }
}
```

**VAPID key generation** (run once during project setup):
```bash
node -e "const wp = require('web-push'); console.log(wp.generateVAPIDKeys())"
```
Copy the output `publicKey` and `privateKey` to `.env.local` and Vercel dashboard.

---

## File Upload Parsing Pattern

```typescript
// pages/api/meetings/[teammateId]/upload.ts
import formidable from 'formidable'

export const config = {
  api: {
    bodyParser: false,    // MUST disable to allow formidable to parse stream
  },
}

async function parseUpload(req: NextApiRequest): Promise<{ buffer: Buffer; extension: string }> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFiles: 1,
      maxFileSize: 10 * 1024 * 1024,   // 10MB — enforces BR-3.03
      fileWriteStreamHandler: undefined, // Use in-memory storage
    })
    form.parse(req, (err, _fields, files) => {
      if (err) return reject(err)
      const file = Array.isArray(files.file) ? files.file[0] : files.file
      if (!file) return reject(new Error('No file provided'))
      resolve({
        buffer: file.toBuffer?.() ?? Buffer.from([]),  // formidable v3 in-memory
        extension: path.extname(file.originalFilename ?? '').toLowerCase(),
      })
    })
  })
}
```

> **Note**: Formidable v3 in-memory storage — files are held in memory as `Buffer`, never written to disk. This is correct for Vercel serverless functions (read-only filesystem).

---

## Vercel Function Configuration

Routes requiring extended timeout beyond the default 10s:

```typescript
// pages/api/transcription/transcribe.ts
export const config = {
  maxDuration: 60,    // Whisper API call can take up to 30s for long recordings
}

// pages/api/jobs/process-analysis.ts
export const config = {
  maxDuration: 60,    // Claude Sonnet analysis (~30s) + job claim + persist + notify
  api: {
    bodyParser: false,  // Cron handler does not need a request body
  },
}
```

All other Unit 3 routes use the default 10s timeout — they are simple CRUD operations.

---

## Vercel Cron Configuration

```json
// vercel.json (Unit 3 replaces Unit 1 scaffold cron entry)
{
  "crons": [
    {
      "path": "/api/jobs/process-analysis",
      "schedule": "*/30 * * * * *"    // Every 30 seconds
    }
  ]
}
```

> **Note**: Vercel cron minimum interval is 1 minute on Hobby plan. The 30-second schedule shown above requires Vercel Pro. For Hobby plan, use `"0 * * * *"` (every hour) during development, or trigger manually for testing.

---

## Environment Variables (Unit 3 Additions)

| Variable | Exposure | Where Set | Description |
|----------|---------|-----------|-------------|
| `OPENAI_API_KEY` | Server-side only | `.env.local` + Vercel dashboard | OpenAI API key for Whisper transcription |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client bundle (safe) | `.env.local` + Vercel dashboard | VAPID public key for push subscription registration |
| `VAPID_PRIVATE_KEY` | Server-side only | `.env.local` + Vercel dashboard | VAPID private key for push notification signing |
| `VAPID_SUBJECT` | Server-side only | `.env.local` + Vercel dashboard | VAPID contact identifier (e.g., `mailto:admin@example.com`) |
| `SUPABASE_URL` | Server-side only | `.env.local` + Vercel dashboard | Supabase project URL for Storage client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only | `.env.local` + Vercel dashboard | Supabase service role key for full storage access |

**Full `.env.local` after Unit 3** (add to existing Unit 1–2 variables):
```
# Unit 1
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SECRET_KEY=local-dev-secret-key-32chars-min!!
RESEND_API_KEY=re_...
CRON_SECRET=local-cron-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Unit 2
ANTHROPIC_API_KEY=sk-ant-...

# Unit 3
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BExamplePublicKeyBase64UrlEncodedString...
VAPID_PRIVATE_KEY=ExamplePrivateKeyBase64UrlEncodedString...
VAPID_SUBJECT=mailto:admin@example.com
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Token Budget

| Call | `max_tokens` | Rationale |
|------|-------------|-----------|
| `analyze` meeting (Sonnet) | `2048` | JSON with 2–5 themes (each ~100 tokens), 1–3 tags, tone phrase, 1-sentence summary, 0–N commitments. 2048 provides generous headroom for meetings with many commitments. |

---

## Inherited Tech Stack Decisions (No Changes from Units 1–2)

| Decision | Value |
|----------|-------|
| Framework | Next.js 14 (Pages Router) |
| Language | TypeScript (strict mode) |
| ORM | Prisma v5 (dual-URL for PgBouncer + migrations) |
| Database | Supabase PostgreSQL |
| Auth | `jose` v5 JWT + httpOnly cookie |
| Password hashing | `bcryptjs` v2 (cost factor 12) |
| Email | Resend (extended with 2 new email templates in Unit 3) |
| Claude SDK | `@anthropic-ai/sdk` (reused from Unit 2) |
| Styling | Tailwind CSS v3 |
| Testing | Jest + ts-jest |
| Hosting | Vercel (serverless, Pages Router) |
| Logging | Console only |
| Claude retry helper | `callClaudeWithRetry` from `lib/claude.ts` (Unit 2, reused) |
| Environments | development + production |

---

## Decision Log

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 1 | `openai` npm package for Whisper | Raw `fetch` to OpenAI API | SDK handles auth, TypeScript types, file upload (multipart/form-data) automatically; same pattern as `@anthropic-ai/sdk` |
| 2 | `formidable` for file upload | `busboy` / `multer` | `formidable` is the most commonly documented Next.js Pages Router multipart solution; v3 has in-memory storage; ships TypeScript types |
| 3 | `@supabase/supabase-js` for Storage | Custom fetch to Supabase Storage REST API | SDK handles authentication headers, presigned URL generation, and provides typed responses; avoids reimplementing Storage auth |
| 4 | `mammoth` for .docx | `docx-parser` / `jszip` + manual XML | `mammoth` is purpose-built for plain-text extraction from .docx; handles complex formatting without exposing XML internals |
| 5 | `pdf-parse` for .pdf | `pdf2json` / `pdfjs-dist` | `pdf-parse` is lightweight with no native dependencies; adequate for text-based PDFs (meeting transcripts); `pdfjs-dist` is heavier and primarily browser-focused |
| 6 | `web-push` for push notifications | Firebase Cloud Messaging (FCM) | `web-push` uses the W3C Web Push standard directly; no vendor lock-in; works with any push-capable browser; VAPID is the standard protocol |
| 7 | `maxDuration: 60` for cron + transcribe | `maxDuration: 30` | Claude Sonnet analysis + Whisper transcription can each take 30–40s; 30s is insufficient; 60s provides safe headroom within Vercel Hobby limits |
| 8 | Single Claude call for full analysis | Separate calls for themes/summary vs. commitments | Single call is faster (one round-trip), cheaper (one invocation), and simpler to parse; JSON structure enforces all fields in one response; mirrors Unit 2 profile synthesis pattern |
| 9 | Cron-based retry (not in-request retry) | In-request retry with `callClaudeWithRetry` | Claude analysis failures within a cron invocation leave the Vercel function blocked; cron-based retry decouples failure handling from the synchronous request lifecycle |
| 10 | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Serve VAPID public key via API endpoint | Build-time baking via `NEXT_PUBLIC_` is simpler than a dedicated API route; VAPID public keys are designed to be public — no security concern |
