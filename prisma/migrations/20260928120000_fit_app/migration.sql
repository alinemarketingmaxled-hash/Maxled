-- CreateTable
CREATE TABLE "FitProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FitProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FitBioRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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
CREATE TABLE "FitWorkoutLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
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
CREATE UNIQUE INDEX "FitProfile_userId_key" ON "FitProfile"("userId");

-- CreateIndex
CREATE INDEX "FitBioRecord_userId_measuredAt_idx" ON "FitBioRecord"("userId", "measuredAt");

-- CreateIndex
CREATE INDEX "FitWorkoutLog_userId_performedAt_idx" ON "FitWorkoutLog"("userId", "performedAt");

-- AddForeignKey
ALTER TABLE "FitProfile" ADD CONSTRAINT "FitProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitBioRecord" ADD CONSTRAINT "FitBioRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FitWorkoutLog" ADD CONSTRAINT "FitWorkoutLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

