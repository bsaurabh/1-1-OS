-- CreateEnum
CREATE TYPE "ExcelAnalysisStatus" AS ENUM ('COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "excel_analyses" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sheetName" TEXT,
    "rowCount" INTEGER NOT NULL,
    "schemaMapping" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "insights" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "status" "ExcelAnalysisStatus" NOT NULL DEFAULT 'COMPLETE',
    "analysedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excel_analyses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "excel_analyses" ADD CONSTRAINT "excel_analyses_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
