-- CreateTable
CREATE TABLE "FitAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "crmUserId" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitProfile" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitBioRecord" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "weightKg" DOUBLE PRECISION NOT NULL,
    "bodyFatPct" DOUBLE PRECISION,
    "muscleMassKg" DOUBLE PRECISION,
    "leanMassKg" DOUBLE PRECISION,
    "visceralFat" DOUBLE PRECISION,
    "waterPct" DOUBLE PRECISION,
    "boneMassKg" DOUBLE PRECISION,
    "bmrKcal" INTEGER,
    "metabolicAge" INTEGER,
    "waistCm" DOUBLE PRECISION,
    "hipCm" DOUBLE PRECISION,
    "chestCm" DOUBLE PRECISION,
    "armCm" DOUBLE PRECISION,
    "thighCm" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FitBioRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitBioImage" (
    "id" TEXT NOT NULL,
    "bioId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FitBioImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitWorkoutLog" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weekNumber" INTEGER NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "durationMin" INTEGER,
    "rpe" INTEGER,
    "entries" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FitWorkoutLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FitAccount_email_key" ON "FitAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FitAccount_crmUserId_key" ON "FitAccount"("crmUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FitProfile_accountId_key" ON "FitProfile"("accountId");

-- CreateIndex
CREATE INDEX "FitBioRecord_accountId_measuredAt_idx" ON "FitBioRecord"("accountId", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "FitBioImage_bioId_key" ON "FitBioImage"("bioId");

-- CreateIndex
CREATE INDEX "FitWorkoutLog_accountId_performedAt_idx" ON "FitWorkoutLog"("accountId", "performedAt");

-- AddForeignKey
ALTER TABLE "FitAccount" ADD CONSTRAINT "FitAccount_crmUserId_fkey" FOREIGN KEY ("crmUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitProfile" ADD CONSTRAINT "FitProfile_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FitAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitBioRecord" ADD CONSTRAINT "FitBioRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FitAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitBioImage" ADD CONSTRAINT "FitBioImage_bioId_fkey" FOREIGN KEY ("bioId") REFERENCES "FitBioRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitWorkoutLog" ADD CONSTRAINT "FitWorkoutLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FitAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

