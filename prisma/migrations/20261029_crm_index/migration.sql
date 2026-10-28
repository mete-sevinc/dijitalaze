-- CreateTable
CREATE TABLE "CrmRecord" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "crmModifiedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSyncState" (
    "module" TEXT NOT NULL,
    "since" TEXT,
    "inPass" BOOLEAN NOT NULL DEFAULT false,
    "fullPass" BOOLEAN NOT NULL DEFAULT false,
    "passSince" TEXT,
    "pageOffset" INTEGER NOT NULL DEFAULT 0,
    "maxSeen" TEXT,
    "passStartedAt" TIMESTAMP(3),
    "lastFullAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSyncState_pkey" PRIMARY KEY ("module")
);

-- CreateIndex
CREATE INDEX "CrmRecord_module_syncedAt_idx" ON "CrmRecord"("module", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmRecord_module_recordId_key" ON "CrmRecord"("module", "recordId");
