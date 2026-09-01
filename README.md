# Bory & Norbert — Foundation + BUY USDT flow

A Guinea-focused GNF ⇄ USDT exchange with a mobile-money-style experience.
This repository is **iteration 1**: the technical foundation and the **BUY USDT**
transaction flow only. No SELL flow, no notifications, no affiliate program, no
real provider integrations yet.

> The application never depends on Orange Money, Binance or any vendor directly.
> Everything goes through `PaymentProvider` / `CryptoProvider` abstractions with
> **mock implementations** shipped first.

---

## Contents

- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Running the BUY flow](#running-the-buy-flow)
- [Transaction state machine](#transaction-state-machine)
- [Provider abstraction](#provider-abstraction)
- [Money handling](#money-handling)
- [Tests](#tests)
- [Security roadmap](#security-roadmap)
- [Not built yet](#not-built-yet)

---

## Architecture

```
apps/
  api/   NestJS + Prisma + BullMQ. Clean modular layout:
         common/*  -> config, prisma, redis (+lock), idempotency, audit, rbac,
                      rate-limit, queue, errors, health, request context, mock store
         modules/* -> auth, users, pricing, quotes, transactions (state-machine +
                      buy-flow orchestrator + BullMQ processors), treasury,
                      payment-providers, crypto-providers, audit-logs, admin,
                      mock-control
  web/   Next.js (App Router) + Tailwind. Ivory / forest green / gold, mobile-first.
packages/
  money/         framework-free Decimal money kit (decimal.js). No JS floats.
  shared-types/  enums + DTO types + the transition table, shared web <-> api
```

Request → `RequestContext` (AsyncLocalStorage: request id / ip) → `JwtAuthGuard` →
`RolesGuard` → `ThrottlerGuard` → `IdempotencyInterceptor` → controller → service.
Every money mutation runs inside a Postgres transaction with `SELECT … FOR UPDATE`
row locks and writes an append-only audit row atomically.

## Tech stack

Monorepo (pnpm workspaces + Turborepo) · Next.js + TypeScript · NestJS + TypeScript
· PostgreSQL · Prisma · Redis (cache / locks / BullMQ queues) · Docker Compose ·
REST.

## Prerequisites

- Node.js 22 (`.nvmrc`)
- pnpm 9 (`corepack enable`)
- Docker + Docker Compose

## Quick start

```bash
cp .env.example .env
pnpm install

# infra
docker compose up -d postgres redis

# database
pnpm --filter @bn/api prisma migrate deploy
pnpm --filter @bn/api prisma generate
pnpm --filter @bn/api db:seed

# run everything (api :3001, web :3000)
pnpm dev
```

Seeded accounts:

| Role       | Phone           | Password       |
|------------|-----------------|----------------|
| Admin      | `+224600000000` | `Admin123!`    |
| Treasury   | `+224600000001` | `Treasury123!` |
| Compliance | `+224600000002` | `Compliance123!` |
| User       | `+224610000000` | `Test123!`     |

Seeded treasury: **5,000,000,000 GNF** and **100,000 USDT** available.
Seeded pricing: market rate **8600 GNF/USDT**, BUY spread **250 bps** → buy rate
**8815 GNF/USDT**, quote TTL **90 s**.

API docs (non-prod): http://localhost:3001/docs · DB browser: http://localhost:8080

### Everything in containers

```bash
docker compose up --build
```

## Running the BUY flow

### In the UI

1. http://localhost:3000 → **Créer un compte** (or log in with the seeded user).
2. **Acheter** → type a GNF amount → a quote appears with the USDT you receive and
   a live countdown.
3. Paste a USDT address (`T…` TRON or `0x…` EVM) → **Confirmer et payer**.
4. On the tracking page, under **Simulation (démo)** (needs an admin session in the
   same browser, or use curl below) press **Paiement réussi** → the stepper runs
   to **COMPLETED**.
5. Check `/admin/treasury`: USDT `available` fell by the quote amount, GNF
   `available` rose by the amount paid.

### Headless (curl)

```bash
API=http://localhost:3001/api/v1

# 1. register
TOK=$(curl -s $API/auth/register -H 'content-type: application/json' \
  -d '{"phone":"+224620001122","password":"Passw0rd!","firstName":"A","lastName":"B"}' \
  | jq -r .accessToken)

# 2. quote
QUOTE=$(curl -s $API/quotes -H "authorization: Bearer $TOK" \
  -H 'content-type: application/json' -H 'idempotency-key: q-1' \
  -d '{"gnfAmount":"1000000"}')
QID=$(echo "$QUOTE" | jq -r .id); echo "$QUOTE" | jq '{usdtAmount,bnRate,expiresInSeconds}'

# 3. accept -> transaction, WAITING_PAYMENT
TX=$(curl -s $API/quotes/$QID/accept -H "authorization: Bearer $TOK" \
  -H 'content-type: application/json' -H 'idempotency-key: a-1' \
  -d "{\"destinationAddress\":\"T${_:-111111111111111111111111111111111}\"}")
TID=$(echo "$TX" | jq -r .id)

# 4. admin session
ADM=$(curl -s $API/auth/login -H 'content-type: application/json' \
  -d '{"phone":"+224600000000","password":"Admin123!"}' | jq -r .accessToken)

# 5. simulate a successful payment -> drives to COMPLETED
curl -s $API/mock/payment/$TID/event -H "authorization: Bearer $ADM" \
  -H 'content-type: application/json' -d '{"scenario":"PAYMENT_SUCCESS"}' | jq .status
```

### Mock scenarios

`POST /mock/payment/:txId/event` — `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `DELAYED`,
`TIMEOUT`, `INSUFFICIENT_BALANCE`.
`POST /mock/crypto/:txId/event` — `SENT`, `CONFIRMED`, `FAILED`.

These endpoints 404 unless `MOCK_PROVIDERS_ENABLED=true` and require the `ADMIN` role.

## Transaction state machine

```
CREATED ─▶ QUOTE_LOCKED ─▶ WAITING_PAYMENT ─▶ PAYMENT_DETECTED ─▶ PAYMENT_CONFIRMED
                                                                        │
                                        USDT_PROCESSING ◀───────────────┘
                                                │
                                          USDT_SENT ─▶ COMPLETED
```

| From | Allowed to |
|---|---|
| CREATED | QUOTE_LOCKED, CANCELLED, EXPIRED |
| QUOTE_LOCKED | WAITING_PAYMENT, CANCELLED, EXPIRED |
| WAITING_PAYMENT | PAYMENT_DETECTED, CANCELLED, EXPIRED, FAILED, MANUAL_REVIEW |
| PAYMENT_DETECTED | PAYMENT_CONFIRMED, FAILED, MANUAL_REVIEW |
| PAYMENT_CONFIRMED | USDT_PROCESSING, FAILED, MANUAL_REVIEW |
| USDT_PROCESSING | USDT_SENT, FAILED, MANUAL_REVIEW |
| USDT_SENT | COMPLETED, MANUAL_REVIEW |
| MANUAL_REVIEW | USDT_PROCESSING, PAYMENT_CONFIRMED, COMPLETED, FAILED, CANCELLED |
| COMPLETED / FAILED / EXPIRED / CANCELLED | *(terminal)* |

- `TransactionStateMachine.apply()` is the **only** writer of `Transaction.status`.
  It locks the row, validates the move against the table above, runs an optional
  in-transaction side effect (treasury moves), then writes the new status + an
  append-only `TransactionEvent` + an `AuditLog`.
- **Idempotent**: `(transactionId, event, nextStatus)` is unique; a replayed event
  is a no-op.
- On `FAILED` / `EXPIRED` / `CANCELLED` all `HELD` reservations are released. When
  GNF has already been received the flow routes to `MANUAL_REVIEW` (refund owed)
  rather than auto-failing.

### Treasury movements for a BUY

| Step | Effect |
|---|---|
| accept (`QUOTE_LOCKED`) | reserve **USDT** = `usdtAmount` (available → reserved) — prevents overselling |
| `PAYMENT_CONFIRMED` | credit **GNF** available (client's francs received) |
| `COMPLETED` | consume the USDT reservation (reserved → out of treasury) |
| `FAILED` / `EXPIRED` / `CANCELLED` (pre-payment) | release the USDT reservation |

## Provider abstraction

```ts
interface PaymentProvider {
  collect(req): Promise<CollectResult>;
  payout(req): Promise<PayoutResult>;            // stub, for refunds / SELL later
  checkTransaction(providerRef): Promise<CheckTransactionResult>;
  getBalance(currency): Promise<{ available: string }>;
}

interface CryptoProvider {
  sendUSDT(req): Promise<SendUsdtResult>;
  getTransaction(txHash): Promise<CryptoTransactionResult>;
  getBalance(): Promise<{ available: string }>;
  validateAddress(address): boolean;
}
```

Concrete provider is chosen by `PAYMENT_PROVIDER` / `CRYPTO_PROVIDER` env
(only `mock` is wired). `MockOrangeMoneyProvider` and `MockCryptoProvider` read the
per-transaction scenario an admin pushes through `/mock/*`. Every outbound call is
wrapped in a `ProviderOperation` row keyed by `${transactionId}:${operation}` so
retries never double-collect or double-send.

## Money handling

- **No JavaScript floating point anywhere.** `packages/money` wraps `decimal.js`;
  it refuses to build a `Money` from a non-integer JS `number`.
- Postgres `DECIMAL(38,18)`, Prisma `Decimal`. Amounts are quantised to the asset
  scale (GNF 0 dp, USDT 6 dp) before persisting; USDT owed to a client is always
  rounded **down**.
- Money crosses the API as canonical decimal **strings**, never numbers.

## Tests

```bash
# unit — pure domain logic, no infra
pnpm --filter @bn/money test
pnpm --filter @bn/api test          # state machine, transitions

# e2e — full simulated BUY flow + failure paths (needs the test infra)
docker compose -f docker-compose.test.yml up -d
pnpm --filter @bn/api test:e2e
docker compose -f docker-compose.test.yml down -v
```

E2E coverage: happy path to `COMPLETED` with treasury assertions and the full
event timeline; `PAYMENT_FAILED → FAILED`, `TIMEOUT → EXPIRED`, insufficient
liquidity → `409`, crypto `FAILED → MANUAL_REVIEW` → admin retry → `COMPLETED`,
expired-quote accept → `410`, idempotency-key replay, and a concurrency test
proving two simultaneous accepts cannot oversell the USDT float.

## Deploy (single VPS, Docker)

`deploy/` contains a production stack: Postgres, Redis, the API, the web app, and
a **Caddy** reverse proxy that terminates TLS (Let's Encrypt) and routes
`/api/*` → API, everything else → web, all on one domain.

```bash
# on the server, with Docker + Compose installed and DNS pointing at it
git clone https://github.com/OddoMaxi/bndcoin.git /opt/bndcoin
cd /opt/bndcoin/deploy
cp .env.prod.example .env         # set PUBLIC_URL, POSTGRES_PASSWORD, JWT secrets
#   edit ../deploy/Caddyfile if the domain differs
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api pnpm --filter @bn/api db:seed
```

`NEXT_PUBLIC_API_URL` is baked into the web image at build time from
`PUBLIC_URL`; change it → `up -d --build web`. `MOCK_PROVIDERS_ENABLED=true` is
kept on so the BUY flow is demoable (only mock providers exist in this iteration).

## Security roadmap

**Implemented now** — RBAC guard + role enum, JWT access + rotating refresh
tokens (hashed at rest), argon2 passwords, `Idempotency-Key` enforcement with
stored-response replay, per-route rate limiting, append-only audit log written in
the same transaction as each change, server-side state-machine validation,
DB-level oversell protection.

**Scaffolded (schema only)** — `KycProfile`, `TransactionLimit` (enforced for
per-transaction GNF min/max at quote time), `AmlFlag`, KYC levels on `User`.

**Deliberately deferred** — OTP delivery, real KYC/AML provider calls, daily /
monthly velocity limits enforcement, device fingerprinting, refund payout
execution (the state machine supports the path; execution is out of scope).

Rate-limit storage is in-memory in this iteration (single instance); swap to a
Redis-backed `ThrottlerStorage` before running more than one API replica.

## Not built yet

SELL flow · events / notifications · affiliate program · real Orange Money /
Binance / on-chain integrations · hardware integrations.
