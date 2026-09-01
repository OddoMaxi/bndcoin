-- Bory & Norbert initial schema (foundation + BUY USDT flow).

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'TREASURY_OPS', 'COMPLIANCE');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_KYC');
CREATE TYPE "KycLevel" AS ENUM ('NONE', 'BASIC', 'FULL');
CREATE TYPE "Asset" AS ENUM ('GNF', 'USDT');
CREATE TYPE "TradingPair" AS ENUM ('GNF_USDT');
CREATE TYPE "TransactionType" AS ENUM ('BUY');
CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "TransactionStatus" AS ENUM ('CREATED', 'QUOTE_LOCKED', 'WAITING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_CONFIRMED', 'USDT_PROCESSING', 'USDT_SENT', 'COMPLETED', 'EXPIRED', 'FAILED', 'CANCELLED', 'MANUAL_REVIEW');
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'USER', 'ADMIN', 'PROVIDER');
CREATE TYPE "PaymentMethod" AS ENUM ('ORANGE_MONEY');
CREATE TYPE "ReservationStatus" AS ENUM ('HELD', 'RELEASED', 'CONSUMED');
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE "LedgerBucket" AS ENUM ('AVAILABLE', 'RESERVED');
CREATE TYPE "ProviderType" AS ENUM ('PAYMENT', 'CRYPTO');
CREATE TYPE "ProviderOperationStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
CREATE TYPE "LimitScope" AS ENUM ('GLOBAL', 'ROLE', 'USER', 'KYC_LEVEL');
CREATE TYPE "AmlFlagStatus" AS ENUM ('OPEN', 'CLEARED', 'CONFIRMED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "kycLevel" "KycLevel" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdByIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KycProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "KycLevel" NOT NULL DEFAULT 'NONE',
    "provider" TEXT,
    "providerRef" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "address" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KycProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionLimit" (
    "id" TEXT NOT NULL,
    "scope" "LimitScope" NOT NULL,
    "refId" TEXT,
    "currency" "Asset" NOT NULL,
    "perTxMin" DECIMAL(38,18) NOT NULL,
    "perTxMax" DECIMAL(38,18) NOT NULL,
    "dailyMax" DECIMAL(38,18) NOT NULL,
    "monthlyMax" DECIMAL(38,18) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TransactionLimit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AmlFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "transactionId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" "AmlFlagStatus" NOT NULL DEFAULT 'OPEN',
    "details" JSONB,
    "raisedBy" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AmlFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingConfig" (
    "id" TEXT NOT NULL,
    "pair" "TradingPair" NOT NULL DEFAULT 'GNF_USDT',
    "marketRate" DECIMAL(38,18) NOT NULL,
    "buySpreadBps" INTEGER NOT NULL,
    "sellSpreadBps" INTEGER NOT NULL DEFAULT 0,
    "feeGnfFlat" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "minGnfAmount" DECIMAL(38,18) NOT NULL,
    "maxGnfAmount" DECIMAL(38,18) NOT NULL,
    "quoteTtlSeconds" INTEGER NOT NULL DEFAULT 90,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pair" "TradingPair" NOT NULL DEFAULT 'GNF_USDT',
    "side" "TransactionType" NOT NULL DEFAULT 'BUY',
    "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
    "marketRate" DECIMAL(38,18) NOT NULL,
    "bnRate" DECIMAL(38,18) NOT NULL,
    "spreadBps" INTEGER NOT NULL,
    "feeGnf" DECIMAL(38,18) NOT NULL,
    "gnfAmount" DECIMAL(38,18) NOT NULL,
    "usdtAmount" DECIMAL(38,18) NOT NULL,
    "pricingConfigVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL DEFAULT 'BUY',
    "status" "TransactionStatus" NOT NULL DEFAULT 'CREATED',
    "pair" "TradingPair" NOT NULL DEFAULT 'GNF_USDT',
    "marketRate" DECIMAL(38,18) NOT NULL,
    "bnRate" DECIMAL(38,18) NOT NULL,
    "feeGnf" DECIMAL(38,18) NOT NULL,
    "gnfAmount" DECIMAL(38,18) NOT NULL,
    "usdtAmount" DECIMAL(38,18) NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "paymentProviderKey" TEXT NOT NULL,
    "paymentProviderRef" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'ORANGE_MONEY',
    "payerPhone" TEXT,
    "paymentExpiresAt" TIMESTAMP(3),
    "cryptoProviderKey" TEXT NOT NULL,
    "cryptoTxHash" TEXT,
    "cryptoConfirmations" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "manualReviewReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionEvent" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "previousStatus" "TransactionStatus",
    "nextStatus" "TransactionStatus" NOT NULL,
    "event" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransactionEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryAccount" (
    "id" TEXT NOT NULL,
    "asset" "Asset" NOT NULL,
    "available" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreasuryAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiquidityReservation" (
    "id" TEXT NOT NULL,
    "treasuryAccountId" TEXT NOT NULL,
    "asset" "Asset" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'HELD',
    "quoteId" TEXT,
    "transactionId" TEXT,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiquidityReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryLedgerEntry" (
    "id" TEXT NOT NULL,
    "treasuryAccountId" TEXT NOT NULL,
    "asset" "Asset" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "bucket" "LedgerBucket" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "balanceAfterAvailable" DECIMAL(38,18) NOT NULL,
    "balanceAfterReserved" DECIMAL(38,18) NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreasuryLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderOperation" (
    "id" TEXT NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "transactionId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "request" JSONB,
    "response" JSONB,
    "status" "ProviderOperationStatus" NOT NULL DEFAULT 'PENDING',
    "externalRef" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MockEvent" (
    "id" TEXT NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "transactionId" TEXT,
    "scenario" TEXT NOT NULL,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MockEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

CREATE UNIQUE INDEX "KycProfile_userId_key" ON "KycProfile"("userId");

CREATE UNIQUE INDEX "TransactionLimit_scope_refId_currency_key" ON "TransactionLimit"("scope", "refId", "currency");

CREATE INDEX "AmlFlag_status_idx" ON "AmlFlag"("status");

CREATE UNIQUE INDEX "PricingConfig_pair_version_key" ON "PricingConfig"("pair", "version");
CREATE INDEX "PricingConfig_pair_active_idx" ON "PricingConfig"("pair", "active");

CREATE UNIQUE INDEX "Quote_publicId_key" ON "Quote"("publicId");
CREATE UNIQUE INDEX "Quote_transactionId_key" ON "Quote"("transactionId");
CREATE INDEX "Quote_userId_idx" ON "Quote"("userId");
CREATE INDEX "Quote_status_expiresAt_idx" ON "Quote"("status", "expiresAt");

CREATE UNIQUE INDEX "Transaction_publicId_key" ON "Transaction"("publicId");
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");
CREATE INDEX "Transaction_paymentExpiresAt_idx" ON "Transaction"("paymentExpiresAt");

CREATE UNIQUE INDEX "TransactionEvent_transactionId_event_nextStatus_key" ON "TransactionEvent"("transactionId", "event", "nextStatus");
CREATE INDEX "TransactionEvent_transactionId_createdAt_idx" ON "TransactionEvent"("transactionId", "createdAt");

CREATE UNIQUE INDEX "TreasuryAccount_asset_key" ON "TreasuryAccount"("asset");

CREATE INDEX "LiquidityReservation_status_idx" ON "LiquidityReservation"("status");
CREATE INDEX "LiquidityReservation_transactionId_idx" ON "LiquidityReservation"("transactionId");

CREATE INDEX "TreasuryLedgerEntry_asset_createdAt_idx" ON "TreasuryLedgerEntry"("asset", "createdAt");
CREATE INDEX "TreasuryLedgerEntry_refType_refId_idx" ON "TreasuryLedgerEntry"("refType", "refId");

CREATE UNIQUE INDEX "ProviderOperation_idempotencyKey_key" ON "ProviderOperation"("idempotencyKey");
CREATE INDEX "ProviderOperation_transactionId_idx" ON "ProviderOperation"("transactionId");
CREATE INDEX "ProviderOperation_providerType_providerKey_idx" ON "ProviderOperation"("providerType", "providerKey");

CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

CREATE INDEX "MockEvent_transactionId_idx" ON "MockEvent"("transactionId");

CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KycProfile" ADD CONSTRAINT "KycProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AmlFlag" ADD CONSTRAINT "AmlFlag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AmlFlag" ADD CONSTRAINT "AmlFlag_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransactionEvent" ADD CONSTRAINT "TransactionEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiquidityReservation" ADD CONSTRAINT "LiquidityReservation_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LiquidityReservation" ADD CONSTRAINT "LiquidityReservation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryLedgerEntry" ADD CONSTRAINT "TreasuryLedgerEntry_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderOperation" ADD CONSTRAINT "ProviderOperation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MockEvent" ADD CONSTRAINT "MockEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
