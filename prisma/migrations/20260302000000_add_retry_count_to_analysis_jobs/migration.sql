-- AddColumn retryCount to analysis_jobs
ALTER TABLE "analysis_jobs" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
