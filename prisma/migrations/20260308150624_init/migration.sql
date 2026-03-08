-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('pending', 'crawling', 'analyzing', 'generating_resume', 'ats_checking', 'drafting_email', 'ready_for_review', 'approved', 'sending', 'sent', 'failed', 'rejected', 'replied');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "description" TEXT,
    "linkedin" TEXT,
    "twitter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlData" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rawHtml" TEXT,
    "markdown" TEXT,
    "pages" JSONB,
    "crawledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAnalysis" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "industry" TEXT,
    "product" TEXT,
    "businessModel" TEXT,
    "techStack" JSONB,
    "engineeringTools" JSONB,
    "hiringSignals" JSONB,
    "relevanceScore" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outreach" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'pending',
    "resumePath" TEXT,
    "atsScore" INTEGER,
    "atsDetails" JSONB,
    "emailSubject" TEXT,
    "emailBody" TEXT,
    "sentAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_email_website_key" ON "Company"("email", "website");

-- CreateIndex
CREATE UNIQUE INDEX "CrawlData_companyId_key" ON "CrawlData"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAnalysis_companyId_key" ON "CompanyAnalysis"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Outreach_companyId_key" ON "Outreach"("companyId");

-- AddForeignKey
ALTER TABLE "CrawlData" ADD CONSTRAINT "CrawlData_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAnalysis" ADD CONSTRAINT "CompanyAnalysis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
