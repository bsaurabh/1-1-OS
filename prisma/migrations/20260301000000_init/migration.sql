-- CreateEnum
CREATE TYPE "MeetingSource" AS ENUM ('PASTE', 'UPLOAD', 'VOICE');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING_ANALYSIS', 'ANALYSIS_COMPLETE', 'ANALYSIS_FAILED');

-- CreateEnum
CREATE TYPE "PatternSeverity" AS ENUM ('INFORMATIONAL', 'WATCH', 'ACTION_REQUIRED');

-- CreateEnum
CREATE TYPE "CommitmentOwner" AS ENUM ('MANAGER', 'TEAMMATE');

-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('SUGGESTED', 'OPEN', 'DONE', 'CARRIED_FORWARD', 'DROPPED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "managers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teammates" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "profile" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teammates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "teammateId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "source" "MeetingSource" NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING_ANALYSIS',
    "themes" JSONB,
    "tags" TEXT[],
    "summary" TEXT,
    "tone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patterns" (
    "id" TEXT NOT NULL,
    "teammateId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "PatternSeverity" NOT NULL,
    "evidence" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commitments" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "teammateId" TEXT NOT NULL,
    "meetingId" TEXT,
    "text" TEXT NOT NULL,
    "owner" "CommitmentOwner" NOT NULL,
    "status" "CommitmentStatus" NOT NULL DEFAULT 'SUGGESTED',
    "dueDate" TIMESTAMP(3),
    "carryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_jobs" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "subscription" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "managers_email_key" ON "managers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_jobs_meetingId_key" ON "analysis_jobs"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_managerId_key" ON "push_subscriptions"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- AddForeignKey
ALTER TABLE "teammates" ADD CONSTRAINT "teammates_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_teammateId_fkey" FOREIGN KEY ("teammateId") REFERENCES "teammates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patterns" ADD CONSTRAINT "patterns_teammateId_fkey" FOREIGN KEY ("teammateId") REFERENCES "teammates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_teammateId_fkey" FOREIGN KEY ("teammateId") REFERENCES "teammates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security
ALTER TABLE "managers"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teammates"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "meetings"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patterns"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commitments"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analysis_jobs"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "managers_self" ON "managers"
  FOR ALL USING (id = current_setting('app.manager_id', true));

CREATE POLICY "teammates_by_manager" ON "teammates"
  FOR ALL USING ("managerId" = current_setting('app.manager_id', true));

CREATE POLICY "meetings_by_manager" ON "meetings"
  FOR ALL USING ("managerId" = current_setting('app.manager_id', true));

CREATE POLICY "patterns_by_manager" ON "patterns"
  FOR ALL USING (
    "teammateId" IN (
      SELECT id FROM "teammates"
      WHERE "managerId" = current_setting('app.manager_id', true)
    )
  );

CREATE POLICY "commitments_by_manager" ON "commitments"
  FOR ALL USING ("managerId" = current_setting('app.manager_id', true));

CREATE POLICY "jobs_by_manager" ON "analysis_jobs"
  FOR ALL USING (
    "meetingId" IN (
      SELECT id FROM "meetings"
      WHERE "managerId" = current_setting('app.manager_id', true)
    )
  );

CREATE POLICY "push_by_manager" ON "push_subscriptions"
  FOR ALL USING ("managerId" = current_setting('app.manager_id', true));

CREATE POLICY "tokens_by_manager" ON "password_reset_tokens"
  FOR ALL USING ("managerId" = current_setting('app.manager_id', true));
