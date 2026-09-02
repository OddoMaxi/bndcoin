-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'OPERATIONS', 'TREASURY', 'COMPLIANCE', 'CUSTOMER_SUPPORT', 'EVENT_MANAGER', 'FINANCE', 'AUDITOR', 'ORGANIZER', 'SCANNER_OPERATOR', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_KYC', 'CLOSED');

-- CreateEnum
CREATE TYPE "KycLevel" AS ENUM ('NONE', 'BASIC', 'FULL');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'PHONE_VERIFY', 'EMAIL_VERIFY', 'STEP_UP');

-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('CREATED', 'SENT', 'VERIFIED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "Asset" AS ENUM ('GNF', 'USDT');

-- CreateEnum
CREATE TYPE "QuoteSide" AS ENUM ('BUY_USDT', 'SELL_USDT');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('ACTIVE', 'LOCKED', 'CONSUMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CryptoOrderStatus" AS ENUM ('CREATED', 'QUOTE_LOCKED', 'USDT_RESERVED', 'AWAITING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_RECONCILING', 'PAYMENT_VERIFIED', 'USDT_PROCESSING', 'USDT_SENT', 'AWAITING_CRYPTO', 'CRYPTO_DETECTED', 'CONFIRMING', 'CRYPTO_CONFIRMED', 'GNF_RESERVED', 'PAYOUT_PENDING', 'PAYOUT_PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED', 'UNDER_REVIEW', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'USER', 'ADMIN', 'PROVIDER', 'WORKER');

-- CreateEnum
CREATE TYPE "LedgerNormalSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('HELD', 'RELEASED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('PAYMENT', 'CRYPTO', 'BLOCKCHAIN', 'SMS', 'EMAIL', 'PUSH', 'WALLET');

-- CreateEnum
CREATE TYPE "ProviderOperationStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LimitScope" AS ENUM ('GLOBAL', 'ROLE', 'USER', 'KYC_LEVEL');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupplyStatus" AS ENUM ('DRAFT', 'PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PricingRuleKind" AS ENUM ('TIER', 'SEGMENT', 'PROMO', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ORANGE_MONEY', 'USDT');

-- CreateEnum
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'AWAITING_PAYMENT', 'PAYMENT_DETECTED', 'PAYMENT_RECONCILING', 'PAYMENT_VERIFIED', 'PAYMENT_REJECTED', 'EXPIRED', 'CANCELLED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'RESERVED', 'PROCESSING', 'RECONCILING', 'PAID', 'FAILED', 'CANCELLED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('OPEN', 'MATCHED', 'MISMATCH', 'MANUAL_REVIEW', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ModemStatus" AS ENUM ('ONLINE', 'AVAILABLE', 'BUSY', 'OFFLINE', 'SIM_ERROR', 'USSD_ERROR', 'LIMIT_REACHED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "SimStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'PUK_LOCKED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrangeSessionKind" AS ENUM ('USSD', 'SMS', 'HEALTHCHECK', 'BALANCE');

-- CreateEnum
CREATE TYPE "OrangeSessionStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "CryptoNetworkStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'DETECTED', 'CONFIRMING', 'CONFIRMED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('CREATED', 'SIGNING', 'BROADCAST', 'CONFIRMING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "WalletKind" AS ENUM ('DEPOSIT', 'HOT', 'COLD');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('CONCERT', 'FESTIVAL', 'CONFERENCE', 'SPORT', 'NIGHTLIFE', 'CULTURE', 'BUSINESS', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'SOLD_OUT', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TicketTypeStatus" AS ENUM ('ACTIVE', 'PAUSED', 'SOLD_OUT', 'HIDDEN');

-- CreateEnum
CREATE TYPE "EventOrderStatus" AS ENUM ('CREATED', 'AWAITING_PAYMENT', 'PAID', 'ISSUED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'USED', 'CANCELLED', 'REFUNDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CheckinResult" AS ENUM ('VALID', 'ALREADY_USED', 'INVALID', 'BLOCKED', 'WRONG_EVENT');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'MOCKED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "publicUserId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "country" TEXT NOT NULL DEFAULT 'GN',
    "address" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "kycLevel" "KycLevel" NOT NULL DEFAULT 'NONE',
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedById" TEXT,
    "createdByIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "channel" "OtpChannel" NOT NULL DEFAULT 'SMS',
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'LOGIN',
    "destination" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "status" "OtpStatus" NOT NULL DEFAULT 'CREATED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "sentAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "identityDocumentType" TEXT,
    "identityDocumentNumber" TEXT,
    "identityDocumentFront" TEXT,
    "identityDocumentBack" TEXT,
    "selfie" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycReview" (
    "id" TEXT NOT NULL,
    "kycRecordId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "decision" "KycStatus" NOT NULL,
    "reason" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLimit" (
    "id" TEXT NOT NULL,
    "scope" "LimitScope" NOT NULL,
    "refId" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" "Asset" NOT NULL,
    "normalSide" "LedgerNormalSide" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerJournal" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "memo" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "LedgerJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" "Asset" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryAccount" (
    "id" TEXT NOT NULL,
    "asset" "Asset" NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'MAIN',
    "available" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreasuryMovement" (
    "id" TEXT NOT NULL,
    "treasuryAccountId" TEXT NOT NULL,
    "asset" "Asset" NOT NULL,
    "bucket" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "balanceAfter" DECIMAL(38,18) NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidityReservation" (
    "id" TEXT NOT NULL,
    "treasuryAccountId" TEXT NOT NULL,
    "asset" "Asset" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'HELD',
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiquidityReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "phone" TEXT,
    "email" TEXT,
    "company" TEXT,
    "verificationStatus" "SupplierStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPurchase" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "quantityUsdt" DECIMAL(38,18) NOT NULL,
    "purchaseCurrency" "Asset" NOT NULL DEFAULT 'GNF',
    "purchaseAmount" DECIMAL(38,18) NOT NULL,
    "unitCostGnf" DECIMAL(38,18) NOT NULL,
    "network" TEXT,
    "txHash" TEXT,
    "paymentReference" TEXT,
    "status" "SupplyStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "asset" "Asset" NOT NULL DEFAULT 'USDT',
    "quantity" DECIMAL(38,18) NOT NULL,
    "quantityRemaining" DECIMAL(38,18) NOT NULL,
    "unitCostGnf" DECIMAL(38,18) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" TEXT NOT NULL,
    "referenceRate" DECIMAL(38,18) NOT NULL,
    "riskBufferBps" INTEGER NOT NULL DEFAULT 0,
    "quoteTtlSeconds" INTEGER NOT NULL DEFAULT 120,
    "minGnfAmount" DECIMAL(38,18) NOT NULL,
    "maxGnfAmount" DECIMAL(38,18) NOT NULL,
    "minUsdtAmount" DECIMAL(38,18) NOT NULL,
    "maxUsdtAmount" DECIMAL(38,18) NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "kind" "PricingRuleKind" NOT NULL DEFAULT 'TIER',
    "side" "QuoteSide" NOT NULL,
    "minUsdt" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "maxUsdt" DECIMAL(38,18),
    "segment" TEXT,
    "spreadAbs" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "spreadPct" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "feeFixedGnf" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "feePct" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceQuote" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "QuoteSide" NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'ACTIVE',
    "referenceRate" DECIMAL(38,18) NOT NULL,
    "spread" DECIMAL(38,18) NOT NULL,
    "fees" DECIMAL(38,18) NOT NULL,
    "finalRate" DECIMAL(38,18) NOT NULL,
    "gnfAmount" DECIMAL(38,18) NOT NULL,
    "usdtAmount" DECIMAL(38,18) NOT NULL,
    "networkId" TEXT,
    "segment" TEXT,
    "pricingVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoOrder" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "QuoteSide" NOT NULL,
    "status" "CryptoOrderStatus" NOT NULL DEFAULT 'CREATED',
    "quoteId" TEXT,
    "referenceRate" DECIMAL(38,18) NOT NULL,
    "finalRate" DECIMAL(38,18) NOT NULL,
    "feesGnf" DECIMAL(38,18) NOT NULL,
    "gnfAmount" DECIMAL(38,18) NOT NULL,
    "usdtAmount" DECIMAL(38,18) NOT NULL,
    "cogsGnf" DECIMAL(38,18),
    "marginGnf" DECIMAL(38,18),
    "networkId" TEXT,
    "destinationAddress" TEXT,
    "depositAddress" TEXT,
    "paymentIntentId" TEXT,
    "payoutId" TEXT,
    "failureReason" TEXT,
    "reviewReason" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CryptoOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoOrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "previousStatus" "CryptoOrderStatus",
    "nextStatus" "CryptoOrderStatus" NOT NULL,
    "event" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CryptoOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoNetwork" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "asset" "Asset" NOT NULL DEFAULT 'USDT',
    "networkName" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "depositEnabled" BOOLEAN NOT NULL DEFAULT false,
    "withdrawEnabled" BOOLEAN NOT NULL DEFAULT false,
    "confirmationsRequired" INTEGER NOT NULL DEFAULT 12,
    "minimumAmount" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "withdrawalFee" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "contractAddress" TEXT,
    "explorerUrl" TEXT,
    "addressRegex" TEXT,
    "status" "CryptoNetworkStatus" NOT NULL DEFAULT 'DISABLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletAddress" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "asset" "Asset" NOT NULL DEFAULT 'USDT',
    "kind" "WalletKind" NOT NULL DEFAULT 'DEPOSIT',
    "address" TEXT NOT NULL,
    "derivationRef" TEXT,
    "assignedRefType" TEXT,
    "assignedRefId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoDeposit" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "networkId" TEXT NOT NULL,
    "asset" "Asset" NOT NULL DEFAULT 'USDT',
    "address" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "txHash" TEXT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "detectedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoWithdrawal" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "networkId" TEXT NOT NULL,
    "asset" "Asset" NOT NULL DEFAULT 'USDT',
    "toAddress" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "fee" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "txHash" TEXT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" TEXT NOT NULL,
    "broadcastAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentIntent" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'ORANGE_MONEY',
    "amount" DECIMAL(38,18) NOT NULL,
    "currency" "Asset" NOT NULL DEFAULT 'GNF',
    "customerPhone" TEXT,
    "assignedGateway" TEXT,
    "assignedModemId" TEXT,
    "externalReference" TEXT,
    "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'ORANGE_MONEY',
    "amount" DECIMAL(38,18) NOT NULL,
    "currency" "Asset" NOT NULL DEFAULT 'GNF',
    "toPhone" TEXT NOT NULL,
    "assignedModemId" TEXT,
    "externalReference" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutEvent" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL,
    "intentId" TEXT,
    "payoutId" TEXT,
    "kind" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "expectedAmount" DECIMAL(38,18),
    "observedAmount" DECIMAL(38,18),
    "correlation" JSONB,
    "mismatchReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrangeGateway" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'mock',
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrangeGateway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrangeSim" (
    "id" TEXT NOT NULL,
    "msisdn" TEXT NOT NULL,
    "label" TEXT,
    "status" "SimStatus" NOT NULL DEFAULT 'ACTIVE',
    "balanceGnf" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "dailyLimit" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "monthlyLimit" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrangeSim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrangeModem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialPort" TEXT,
    "imei" TEXT,
    "simId" TEXT,
    "phoneNumber" TEXT,
    "status" "ModemStatus" NOT NULL DEFAULT 'OFFLINE',
    "balanceGnf" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "dailyTxCount" INTEGER NOT NULL DEFAULT 0,
    "dailyVolume" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "dailyLimit" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "lastHealthcheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "recentFailures" INTEGER NOT NULL DEFAULT 0,
    "activeJobs" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrangeModem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrangeSession" (
    "id" TEXT NOT NULL,
    "modemId" TEXT NOT NULL,
    "kind" "OrangeSessionKind" NOT NULL,
    "command" TEXT,
    "response" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "status" "OrangeSessionStatus" NOT NULL DEFAULT 'STARTED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "OrangeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organizer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "commissionPct" DECIMAL(38,18) NOT NULL DEFAULT 0.05,
    "payoutMsisdn" TEXT,
    "contactEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organizer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" "EventCategory" NOT NULL DEFAULT 'OTHER',
    "coverImage" TEXT,
    "gallery" JSONB,
    "venue" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'GN',
    "eventDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "salesStart" TIMESTAMP(3),
    "salesEnd" TIMESTAMP(3),
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketType" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceGnf" DECIMAL(38,18) NOT NULL,
    "priceUsdt" DECIMAL(38,18),
    "quantity" INTEGER NOT NULL,
    "quantitySold" INTEGER NOT NULL DEFAULT 0,
    "maxPerOrder" INTEGER NOT NULL DEFAULT 10,
    "salesStart" TIMESTAMP(3),
    "salesEnd" TIMESTAMP(3),
    "status" "TicketTypeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOrder" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "EventOrderStatus" NOT NULL DEFAULT 'CREATED',
    "currency" "Asset" NOT NULL DEFAULT 'GNF',
    "subtotalGnf" DECIMAL(38,18) NOT NULL,
    "amountGnf" DECIMAL(38,18) NOT NULL,
    "amountUsdt" DECIMAL(38,18),
    "platformFeeGnf" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "organizerNetGnf" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "paymentIntentId" TEXT,
    "cryptoOrderId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceGnf" DECIMAL(38,18) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "publicTicketId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'VALID',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "usedGate" TEXT,
    "usedBy" TEXT,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkin" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "gate" TEXT,
    "scannedBy" TEXT,
    "result" "CheckinResult" NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checkin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "eventId" TEXT,
    "grossGnf" DECIMAL(38,18) NOT NULL,
    "platformFeeGnf" DECIMAL(38,18) NOT NULL,
    "organizerNetGnf" DECIMAL(38,18) NOT NULL,
    "settledGnf" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "payoutId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderOperation" (
    "id" TEXT NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "MockEvent" (
    "id" TEXT NOT NULL,
    "providerType" "ProviderType" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "scenario" TEXT NOT NULL,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "actorRole" TEXT,
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

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "payload" JSONB,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_publicUserId_key" ON "User"("publicUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "OtpRequest_destination_status_idx" ON "OtpRequest"("destination", "status");

-- CreateIndex
CREATE INDEX "OtpRequest_expiresAt_idx" ON "OtpRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KycRecord_userId_key" ON "KycRecord"("userId");

-- CreateIndex
CREATE INDEX "KycReview_kycRecordId_createdAt_idx" ON "KycReview"("kycRecordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionLimit_scope_refId_currency_key" ON "TransactionLimit"("scope", "refId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_code_key" ON "LedgerAccount"("code");

-- CreateIndex
CREATE INDEX "LedgerJournal_referenceType_referenceId_idx" ON "LedgerJournal"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "LedgerJournal_postedAt_idx" ON "LedgerJournal"("postedAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccount_asset_bucket_key" ON "TreasuryAccount"("asset", "bucket");

-- CreateIndex
CREATE INDEX "TreasuryMovement_asset_bucket_createdAt_idx" ON "TreasuryMovement"("asset", "bucket", "createdAt");

-- CreateIndex
CREATE INDEX "TreasuryMovement_refType_refId_idx" ON "TreasuryMovement"("refType", "refId");

-- CreateIndex
CREATE INDEX "LiquidityReservation_status_idx" ON "LiquidityReservation"("status");

-- CreateIndex
CREATE INDEX "LiquidityReservation_refType_refId_idx" ON "LiquidityReservation"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPurchase_publicId_key" ON "SupplierPurchase"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_purchaseId_key" ON "InventoryLot"("purchaseId");

-- CreateIndex
CREATE INDEX "InventoryLot_asset_quantityRemaining_idx" ON "InventoryLot"("asset", "quantityRemaining");

-- CreateIndex
CREATE INDEX "PricingConfig_active_idx" ON "PricingConfig"("active");

-- CreateIndex
CREATE UNIQUE INDEX "PricingConfig_version_key" ON "PricingConfig"("version");

-- CreateIndex
CREATE INDEX "PricingRule_side_active_priority_idx" ON "PricingRule"("side", "active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "PriceQuote_publicId_key" ON "PriceQuote"("publicId");

-- CreateIndex
CREATE INDEX "PriceQuote_userId_idx" ON "PriceQuote"("userId");

-- CreateIndex
CREATE INDEX "PriceQuote_status_expiresAt_idx" ON "PriceQuote"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoOrder_publicId_key" ON "CryptoOrder"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoOrder_quoteId_key" ON "CryptoOrder"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoOrder_paymentIntentId_key" ON "CryptoOrder"("paymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoOrder_payoutId_key" ON "CryptoOrder"("payoutId");

-- CreateIndex
CREATE INDEX "CryptoOrder_status_idx" ON "CryptoOrder"("status");

-- CreateIndex
CREATE INDEX "CryptoOrder_userId_createdAt_idx" ON "CryptoOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CryptoOrder_side_idx" ON "CryptoOrder"("side");

-- CreateIndex
CREATE INDEX "CryptoOrderEvent_orderId_createdAt_idx" ON "CryptoOrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoOrderEvent_orderId_event_nextStatus_key" ON "CryptoOrderEvent"("orderId", "event", "nextStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoNetwork_key_key" ON "CryptoNetwork"("key");

-- CreateIndex
CREATE INDEX "WalletAddress_assignedRefType_assignedRefId_idx" ON "WalletAddress"("assignedRefType", "assignedRefId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletAddress_networkId_address_key" ON "WalletAddress"("networkId", "address");

-- CreateIndex
CREATE INDEX "CryptoDeposit_status_idx" ON "CryptoDeposit"("status");

-- CreateIndex
CREATE INDEX "CryptoDeposit_address_idx" ON "CryptoDeposit"("address");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoWithdrawal_idempotencyKey_key" ON "CryptoWithdrawal"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CryptoWithdrawal_status_idx" ON "CryptoWithdrawal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_publicId_key" ON "PaymentIntent"("publicId");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX "PaymentIntent_refType_refId_idx" ON "PaymentIntent"("refType", "refId");

-- CreateIndex
CREATE INDEX "PaymentEvent_intentId_createdAt_idx" ON "PaymentEvent"("intentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_publicId_key" ON "Payout"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_idempotencyKey_key" ON "Payout"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_refType_refId_idx" ON "Payout"("refType", "refId");

-- CreateIndex
CREATE INDEX "PayoutEvent_payoutId_createdAt_idx" ON "PayoutEvent"("payoutId", "createdAt");

-- CreateIndex
CREATE INDEX "Reconciliation_status_idx" ON "Reconciliation"("status");

-- CreateIndex
CREATE INDEX "Reconciliation_kind_idx" ON "Reconciliation"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "OrangeGateway_name_key" ON "OrangeGateway"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OrangeSim_msisdn_key" ON "OrangeSim"("msisdn");

-- CreateIndex
CREATE UNIQUE INDEX "OrangeModem_name_key" ON "OrangeModem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OrangeModem_simId_key" ON "OrangeModem"("simId");

-- CreateIndex
CREATE INDEX "OrangeModem_status_enabled_idx" ON "OrangeModem"("status", "enabled");

-- CreateIndex
CREATE INDEX "OrangeSession_modemId_startedAt_idx" ON "OrangeSession"("modemId", "startedAt");

-- CreateIndex
CREATE INDEX "OrangeSession_refType_refId_idx" ON "OrangeSession"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "Organizer_userId_key" ON "Organizer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organizer_slug_key" ON "Organizer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_status_featured_idx" ON "Event"("status", "featured");

-- CreateIndex
CREATE INDEX "Event_eventDate_idx" ON "Event"("eventDate");

-- CreateIndex
CREATE INDEX "TicketType_eventId_idx" ON "TicketType"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_publicId_key" ON "EventOrder"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "EventOrder_paymentIntentId_key" ON "EventOrder"("paymentIntentId");

-- CreateIndex
CREATE INDEX "EventOrder_userId_createdAt_idx" ON "EventOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EventOrder_status_idx" ON "EventOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_publicTicketId_key" ON "Ticket"("publicTicketId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_qrToken_key" ON "Ticket"("qrToken");

-- CreateIndex
CREATE INDEX "Ticket_eventId_status_idx" ON "Ticket"("eventId", "status");

-- CreateIndex
CREATE INDEX "Ticket_userId_idx" ON "Ticket"("userId");

-- CreateIndex
CREATE INDEX "Checkin_eventId_scannedAt_idx" ON "Checkin"("eventId", "scannedAt");

-- CreateIndex
CREATE INDEX "Checkin_ticketId_idx" ON "Checkin"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_publicId_key" ON "Settlement"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_payoutId_key" ON "Settlement"("payoutId");

-- CreateIndex
CREATE INDEX "Settlement_organizerId_status_idx" ON "Settlement"("organizerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderOperation_idempotencyKey_key" ON "ProviderOperation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ProviderOperation_providerType_providerKey_idx" ON "ProviderOperation"("providerType", "providerKey");

-- CreateIndex
CREATE INDEX "ProviderOperation_refType_refId_idx" ON "ProviderOperation"("refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE INDEX "MockEvent_refType_refId_idx" ON "MockEvent"("refType", "refId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Alert_status_severity_idx" ON "Alert"("status", "severity");

-- CreateIndex
CREATE INDEX "Alert_code_idx" ON "Alert"("code");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OtpRequest" ADD CONSTRAINT "OtpRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycRecord" ADD CONSTRAINT "KycRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycReview" ADD CONSTRAINT "KycReview_kycRecordId_fkey" FOREIGN KEY ("kycRecordId") REFERENCES "KycRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "LedgerJournal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryMovement" ADD CONSTRAINT "TreasuryMovement_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidityReservation" ADD CONSTRAINT "LiquidityReservation_treasuryAccountId_fkey" FOREIGN KEY ("treasuryAccountId") REFERENCES "TreasuryAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPurchase" ADD CONSTRAINT "SupplierPurchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "SupplierPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceQuote" ADD CONSTRAINT "PriceQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoOrder" ADD CONSTRAINT "CryptoOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoOrder" ADD CONSTRAINT "CryptoOrder_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "PriceQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoOrder" ADD CONSTRAINT "CryptoOrder_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "CryptoNetwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoOrder" ADD CONSTRAINT "CryptoOrder_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoOrder" ADD CONSTRAINT "CryptoOrder_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoOrderEvent" ADD CONSTRAINT "CryptoOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CryptoOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAddress" ADD CONSTRAINT "WalletAddress_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "CryptoNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoDeposit" ADD CONSTRAINT "CryptoDeposit_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CryptoOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoDeposit" ADD CONSTRAINT "CryptoDeposit_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "CryptoNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoWithdrawal" ADD CONSTRAINT "CryptoWithdrawal_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CryptoOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoWithdrawal" ADD CONSTRAINT "CryptoWithdrawal_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "CryptoNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_assignedModemId_fkey" FOREIGN KEY ("assignedModemId") REFERENCES "OrangeModem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_assignedModemId_fkey" FOREIGN KEY ("assignedModemId") REFERENCES "OrangeModem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutEvent" ADD CONSTRAINT "PayoutEvent_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrangeModem" ADD CONSTRAINT "OrangeModem_simId_fkey" FOREIGN KEY ("simId") REFERENCES "OrangeSim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrangeSession" ADD CONSTRAINT "OrangeSession_modemId_fkey" FOREIGN KEY ("modemId") REFERENCES "OrangeModem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organizer" ADD CONSTRAINT "Organizer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketType" ADD CONSTRAINT "TicketType_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrder" ADD CONSTRAINT "EventOrder_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrderItem" ADD CONSTRAINT "EventOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EventOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOrderItem" ADD CONSTRAINT "EventOrderItem_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "EventOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
