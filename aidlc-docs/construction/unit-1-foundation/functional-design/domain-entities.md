# Domain Entities — Unit 1: Foundation

**Date**: 2026-03-01
**Key decisions**: Profile stored as JSONB · Multi-user isolation via Supabase RLS

---

## Entity Overview

```
Manager (1) ──< Teammate (1) ──< Meeting (1) ──< AnalysisJob (0..1)
                               ──< Pattern
                               ──< Commitment (0..*)
         ──< PushSubscription
         ──< PasswordResetToken
```

---

## Entity Definitions

### Manager
The authenticated user of the application.

| Field        | Type      | Constraints              | Notes                              |
|--------------|-----------|--------------------------|------------------------------------|
| id           | String    | PK, cuid()               | Internal identifier                |
| email        | String    | UNIQUE, NOT NULL         | Used for login and notifications   |
| passwordHash | String    | NOT NULL                 | bcrypt hash, never stored as plain |
| createdAt    | DateTime  | DEFAULT now()            |                                    |
| updatedAt    | DateTime  | Auto-updated             |                                    |

---

### Teammate
A direct report managed by a Manager.

| Field     | Type     | Constraints          | Notes                                              |
|-----------|----------|----------------------|----------------------------------------------------|
| id        | String   | PK, cuid()           |                                                    |
| managerId | String   | FK → Manager, NOT NULL | RLS policy key                                  |
| name      | String   | NOT NULL             |                                                    |
| role      | String   | NOT NULL             |                                                    |
| profile   | Json?    | JSONB, nullable      | AI-generated; null until interview complete        |
| createdAt | DateTime | DEFAULT now()        |                                                    |
| updatedAt | DateTime | Auto-updated         |                                                    |

**Profile JSONB shape** (populated by InterviewAIHandler):
```json
{
  "strengths": "string",
  "growthAreas": "string",
  "careerAspirations": "string",
  "currentProjects": "string",
  "kpis": "string",
  "behavioralTendencies": "string",
  "feedbackStyle": "string",
  "motivationDrivers": "string",
  "performanceNotes": "string",
  "aiSummary": "string"
}
```

---

### Meeting
A single ingested 1:1 session for a Teammate.

| Field      | Type          | Constraints        | Notes                                        |
|------------|---------------|--------------------|----------------------------------------------|
| id         | String        | PK, cuid()         |                                              |
| managerId  | String        | FK → Manager       | Denormalized for RLS efficiency              |
| teammateId | String        | FK → Teammate      |                                              |
| rawText    | String (Text) | NOT NULL           | Original input (paste / extracted / transcription) |
| source     | Enum          | NOT NULL           | `PASTE` \| `UPLOAD` \| `VOICE`               |
| status     | Enum          | DEFAULT PENDING    | `PENDING_ANALYSIS` \| `ANALYSIS_COMPLETE` \| `ANALYSIS_FAILED` |
| themes     | Json?         | JSONB, nullable    | Array of theme strings; set after analysis  |
| tags       | String[]      | Array, nullable    | Category tags set after analysis            |
| summary    | String?       | nullable           | AI one-line summary; set after analysis     |
| tone       | String?       | nullable           | Emotional tone signal; set after analysis   |
| createdAt  | DateTime      | DEFAULT now()      |                                              |
| updatedAt  | DateTime      | Auto-updated       |                                              |

---

### Pattern
A detected behavioral or situational pattern across a Teammate's meeting history.

| Field       | Type     | Constraints     | Notes                                                       |
|-------------|----------|-----------------|-------------------------------------------------------------|
| id          | String   | PK, cuid()      |                                                             |
| teammateId  | String   | FK → Teammate   |                                                             |
| description | String   | Text, NOT NULL  | Human-readable pattern description                         |
| severity    | Enum     | NOT NULL        | `INFORMATIONAL` \| `WATCH` \| `ACTION_REQUIRED`            |
| evidence    | Json     | JSONB, NOT NULL | `[{ meetingId, date, snippet }]`                            |
| detectedAt  | DateTime | DEFAULT now()   | Last detection timestamp (upserted on each full analysis)  |

---

### Commitment
An action item or commitment recorded during or after a 1:1.

| Field      | Type     | Constraints          | Notes                                                         |
|------------|----------|----------------------|---------------------------------------------------------------|
| id         | String   | PK, cuid()           |                                                               |
| managerId  | String   | FK → Manager         | Denormalized for RLS                                          |
| teammateId | String   | FK → Teammate        |                                                               |
| meetingId  | String?  | FK → Meeting, nullable | null = manually created                                    |
| text       | String   | Text, NOT NULL       |                                                               |
| owner      | Enum     | NOT NULL             | `MANAGER` \| `TEAMMATE`                                       |
| status     | Enum     | DEFAULT SUGGESTED    | `SUGGESTED` \| `OPEN` \| `DONE` \| `CARRIED_FORWARD` \| `DROPPED` |
| dueDate    | DateTime | nullable             |                                                               |
| carryCount | Int      | DEFAULT 0            | Incremented each time status → CARRIED_FORWARD                |
| createdAt  | DateTime | DEFAULT now()        |                                                               |
| updatedAt  | DateTime | Auto-updated         |                                                               |

---

### AnalysisJob
Tracks the async analysis queue state for a Meeting.

| Field       | Type     | Constraints          | Notes                          |
|-------------|----------|----------------------|--------------------------------|
| id          | String   | PK, cuid()           |                                |
| meetingId   | String   | FK → Meeting, UNIQUE | One job per meeting            |
| status      | Enum     | DEFAULT PENDING      | `PENDING` \| `PROCESSING` \| `COMPLETE` \| `FAILED` |
| error       | String?  | nullable             | Error message if FAILED        |
| createdAt   | DateTime | DEFAULT now()        |                                |
| processedAt | DateTime | nullable             | Set when job completes or fails |

---

### PushSubscription
Stores the Web Push API subscription object for a Manager.

| Field        | Type     | Constraints         | Notes                                 |
|--------------|----------|---------------------|---------------------------------------|
| id           | String   | PK, cuid()          |                                       |
| managerId    | String   | FK → Manager, UNIQUE| One subscription per manager at a time |
| subscription | Json     | JSONB, NOT NULL     | Full Web Push subscription object     |
| createdAt    | DateTime | DEFAULT now()       |                                       |

---

### PasswordResetToken
Single-use, time-limited tokens for password reset.

| Field     | Type     | Constraints    | Notes                                           |
|-----------|----------|----------------|-------------------------------------------------|
| id        | String   | PK, cuid()     |                                                 |
| managerId | String   | FK → Manager   |                                                 |
| tokenHash | String   | UNIQUE         | SHA-256 hash of the raw token sent in email     |
| expiresAt | DateTime | NOT NULL       | now() + 60 minutes                              |
| usedAt    | DateTime | nullable       | Set immediately when token is consumed          |
| createdAt | DateTime | DEFAULT now()  |                                                 |

---

## Full Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model Manager {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  teammates   Teammate[]
  resetTokens PasswordResetToken[]
  pushSub     PushSubscription?

  @@map("managers")
}

model Teammate {
  id        String   @id @default(cuid())
  managerId String
  name      String
  role      String
  profile   Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  manager     Manager      @relation(fields: [managerId], references: [id], onDelete: Cascade)
  meetings    Meeting[]
  patterns    Pattern[]
  commitments Commitment[]

  @@map("teammates")
}

model Meeting {
  id          String         @id @default(cuid())
  managerId   String
  teammateId  String
  rawText     String         @db.Text
  source      MeetingSource
  status      AnalysisStatus @default(PENDING_ANALYSIS)
  themes      Json?
  tags        String[]
  summary     String?
  tone        String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  teammate    Teammate     @relation(fields: [teammateId], references: [id], onDelete: Cascade)
  commitments Commitment[]
  analysisJob AnalysisJob?

  @@map("meetings")
}

enum MeetingSource {
  PASTE
  UPLOAD
  VOICE
}

enum AnalysisStatus {
  PENDING_ANALYSIS
  ANALYSIS_COMPLETE
  ANALYSIS_FAILED
}

model Pattern {
  id          String          @id @default(cuid())
  teammateId  String
  description String          @db.Text
  severity    PatternSeverity
  evidence    Json
  detectedAt  DateTime        @default(now())

  teammate Teammate @relation(fields: [teammateId], references: [id], onDelete: Cascade)

  @@map("patterns")
}

enum PatternSeverity {
  INFORMATIONAL
  WATCH
  ACTION_REQUIRED
}

model Commitment {
  id          String           @id @default(cuid())
  managerId   String
  teammateId  String
  meetingId   String?
  text        String           @db.Text
  owner       CommitmentOwner
  status      CommitmentStatus @default(SUGGESTED)
  dueDate     DateTime?
  carryCount  Int              @default(0)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  teammate Teammate  @relation(fields: [teammateId], references: [id], onDelete: Cascade)
  meeting  Meeting?  @relation(fields: [meetingId], references: [id])

  @@map("commitments")
}

enum CommitmentOwner {
  MANAGER
  TEAMMATE
}

enum CommitmentStatus {
  SUGGESTED
  OPEN
  DONE
  CARRIED_FORWARD
  DROPPED
}

model AnalysisJob {
  id          String    @id @default(cuid())
  meetingId   String    @unique
  status      JobStatus @default(PENDING)
  error       String?
  createdAt   DateTime  @default(now())
  processedAt DateTime?

  meeting Meeting @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  @@map("analysis_jobs")
}

enum JobStatus {
  PENDING
  PROCESSING
  COMPLETE
  FAILED
}

model PushSubscription {
  id           String   @id @default(cuid())
  managerId    String   @unique
  subscription Json
  createdAt    DateTime @default(now())

  manager Manager @relation(fields: [managerId], references: [id], onDelete: Cascade)

  @@map("push_subscriptions")
}

model PasswordResetToken {
  id        String    @id @default(cuid())
  managerId String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  manager Manager @relation(fields: [managerId], references: [id], onDelete: Cascade)

  @@map("password_reset_tokens")
}
```

---

## Supabase RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE managers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE teammates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings             ENABLE ROW LEVEL SECURITY;
ALTER TABLE patterns             ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_jobs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Managers: own row only
CREATE POLICY managers_self ON managers
  FOR ALL USING (id = current_setting('app.manager_id'));

-- Teammates: scoped to manager
CREATE POLICY teammates_by_manager ON teammates
  FOR ALL USING (manager_id = current_setting('app.manager_id'));

-- Meetings: scoped to manager (managerId denormalized)
CREATE POLICY meetings_by_manager ON meetings
  FOR ALL USING (manager_id = current_setting('app.manager_id'));

-- Patterns: via teammate
CREATE POLICY patterns_by_manager ON patterns
  FOR ALL USING (
    teammate_id IN (
      SELECT id FROM teammates
      WHERE manager_id = current_setting('app.manager_id')
    )
  );

-- Commitments: scoped to manager (managerId denormalized)
CREATE POLICY commitments_by_manager ON commitments
  FOR ALL USING (manager_id = current_setting('app.manager_id'));

-- Analysis jobs: via meeting
CREATE POLICY jobs_by_manager ON analysis_jobs
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings
      WHERE manager_id = current_setting('app.manager_id')
    )
  );

-- Push subscriptions: scoped to manager
CREATE POLICY push_by_manager ON push_subscriptions
  FOR ALL USING (manager_id = current_setting('app.manager_id'));

-- Reset tokens: scoped to manager
CREATE POLICY tokens_by_manager ON password_reset_tokens
  FOR ALL USING (manager_id = current_setting('app.manager_id'));
```

**Note**: `app.manager_id` is set per-request by the API middleware using `SET LOCAL app.manager_id = '<id>'` within each database transaction.
