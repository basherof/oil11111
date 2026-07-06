-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "paymentReference" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "resumeState" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LYD',
    "channel" TEXT NOT NULL DEFAULT 'app',
    "details" JSONB NOT NULL DEFAULT '{}',
    "passengers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exceptions" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bookingReference" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "routedRole" TEXT NOT NULL,
    "assignedTo" TEXT,
    "status" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "suggestedActions" JSONB NOT NULL DEFAULT '[]',
    "slaDueAt" TIMESTAMP(3) NOT NULL,
    "bookingStateAtCreation" TEXT NOT NULL,
    "nextStateAfterResolution" TEXT,
    "internalNotes" JSONB NOT NULL DEFAULT '[]',
    "resolutionAction" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_settings" (
    "id" TEXT NOT NULL,
    "workflowKey" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "permanentA1" BOOLEAN NOT NULL DEFAULT false,
    "thresholds" JSONB NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "killSwitchActive" BOOLEAN NOT NULL DEFAULT false,
    "killSwitchReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_decisions" (
    "id" TEXT NOT NULL,
    "workflowKey" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "thresholdHigh" DOUBLE PRECISION NOT NULL,
    "thresholdMedium" DOUBLE PRECISION NOT NULL,
    "level" TEXT NOT NULL,
    "killSwitch" BOOLEAN NOT NULL DEFAULT false,
    "entityType" TEXT,
    "entityId" TEXT,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "reference" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LYD',
    "payerName" TEXT,
    "method" TEXT,
    "receiptRef" TEXT,
    "bankTxId" TEXT,
    "status" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "decidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_references" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "expectedAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LYD',
    "status" TEXT NOT NULL,
    "amountReceived" DECIMAL(12,2),
    "difference" DECIMAL(12,2),
    "suggestedAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_confirmations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "confirmedFields" JSONB NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "bookingId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "fromState" TEXT,
    "toState" TEXT,
    "confidence" DOUBLE PRECISION,
    "data" JSONB,
    "result" TEXT,
    "error" TEXT,
    "staffOverride" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_items" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "offlineCached" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "to" TEXT,
    "status" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "error" TEXT,
    "providerMode" TEXT NOT NULL DEFAULT 'mock',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "locale" TEXT,
    "fileRef" TEXT,
    "data" JSONB,
    "providerMode" TEXT NOT NULL DEFAULT 'mock',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visa_applications" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "visaType" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "fileStatus" TEXT NOT NULL,
    "appointmentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visa_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "bodyEn" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LYD',
    "status" TEXT NOT NULL,
    "decision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_snapshots" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "metrics" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_paymentReference_key" ON "bookings"("paymentReference");

-- CreateIndex
CREATE INDEX "bookings_state_idx" ON "bookings"("state");

-- CreateIndex
CREATE INDEX "status_history_bookingId_idx" ON "status_history"("bookingId");

-- CreateIndex
CREATE INDEX "exceptions_status_routedRole_slaDueAt_idx" ON "exceptions"("status", "routedRole", "slaDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "automation_settings_workflowKey_key" ON "automation_settings"("workflowKey");

-- CreateIndex
CREATE INDEX "automation_decisions_workflowKey_idx" ON "automation_decisions"("workflowKey");

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_references_reference_key" ON "payment_references"("reference");

-- CreateIndex
CREATE INDEX "customer_confirmations_bookingId_idx" ON "customer_confirmations"("bookingId");

-- CreateIndex
CREATE INDEX "audit_logs_bookingId_idx" ON "audit_logs"("bookingId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "wallet_items_bookingId_idx" ON "wallet_items"("bookingId");

-- CreateIndex
CREATE INDEX "messages_bookingId_idx" ON "messages"("bookingId");

-- CreateIndex
CREATE INDEX "artifacts_bookingId_idx" ON "artifacts"("bookingId");

-- CreateIndex
CREATE INDEX "visa_applications_bookingId_idx" ON "visa_applications"("bookingId");

