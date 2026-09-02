# Bory & Norbert — V1 platform

A Guinea-focused fintech platform with **two business lines**:

- **Crypto** — buy USDT with GNF, sell USDT for GNF (the platform runs its own
  USDT treasury; supply is manual/external in V1).
- **Events** — discover events, buy tickets in GNF or USDT, secure signed-QR
  ticketing, organiser management, gate check-in scanner.

Payments run over **Orange Money PDV SIMs in GSM modems**, behind a gateway that
is architecturally separate from business logic. Everything financial is double-
entry booked and reconciled.

> **Nothing external is faked.** Blockchain, on-chain wallet signing, physical
> Orange modems, SMS/email/push all sit behind interfaces with a **mock** adapter
> and an **unconfigured live** adapter. Master switches (`REAL_MONEY_MODE`,
> `REAL_CRYPTO_MODE`, `ORANGE_MODE`, `OTP_MODE`, `BLOCKCHAIN_PROVIDER`) stay in
> mock/`false` until real credentials and hardware are wired, and the API refuses
> to start a real mode without its dependencies.

Live: **https://rndcoin.koppoddo.cloud** · repo: https://github.com/OddoMaxi/bndcoin

---

## Architecture

Modular monolith. One API, in-process workers (BullMQ), one Postgres, one Redis,
Caddy reverse proxy — all in a dedicated Docker Compose project.

```
Client app · Admin cockpit · Scanner PWA
                  │  REST /api/v1
          ┌───────┴────────┐
          │   NestJS API   │  modules:
          │  (modular      │   auth · users · kyc · pricing · treasury · suppliers
          │   monolith)    │   crypto · payments · orange · reconciliation
          └───────┬────────┘   events · organizers · tickets · settlements
                  │            admin · system   + common: ledger · rbac · queue
   ┌──────────────┼───────────────┐   · alerts · notifications · idempotency
Postgres       Redis          Orange gateway (mock | modem)
(Prisma)     (locks/queues)   Blockchain provider (mock | live)
```

- **Ledger is the source of financial truth** — every money movement posts a
  balanced double-entry journal; a per-currency integrity check runs continuously.
  `TreasuryAccount` bucket balances are a fast cache reconciled against the ledger.
- **State machines** guard both crypto flows: USDT is never sent before a payment
  is *reconciled* (`PAYMENT_VERIFIED`), GNF is never paid before crypto reaches
  the required confirmations. Failures release reservations; ambiguous cases go to
  `UNDER_REVIEW`.
- **Reconciliation gate** — a payment is only `PAYMENT_VERIFIED` after correlating
  order / amount / reference / timing. Never on a single SMS or USSD "success".
- **Idempotency** everywhere financial: HTTP `Idempotency-Key`, provider-op keys,
  payout keys, deterministic transition events.

## Prerequisites

Node 22, pnpm 9 (`corepack enable`), Docker + Compose.

## Quick start (local)

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis
pnpm --filter @bn/api prisma migrate deploy
pnpm --filter @bn/api db:seed
pnpm dev            # api :3001, web :3000
```

Seeded accounts (password login for ops; customers use phone + OTP):

| Role | Phone | Password |
|---|---|---|
| SUPER_ADMIN | `+224600000000` | `Admin123!` |
| OPERATIONS | `+224600000001` | `Ops123!` |
| TREASURY | `+224600000002` | `Treasury123!` |
| COMPLIANCE | `+224600000003` | `Compliance123!` |
| FINANCE | `+224600000004` | `Finance123!` |
| EVENT_MANAGER | `+224600000005` | `Events123!` |
| SCANNER_OPERATOR | `+224600000006` | `Scan123!` |
| ORGANIZER | `+224611111111` | `Organizer123!` |
| CUSTOMER | `+224610000000` | `Test123!` (or OTP) |

In `OTP_MODE=mock` the OTP request response includes `debugCode` so you can log in
without an SMS.

## The two core flows

**BUY USDT** — `POST /quotes {side:BUY_USDT,gnfAmount}` → `POST /crypto/orders/buy
{quoteId,networkId,destinationAddress}` → pay by Orange Money → reconciled →
USDT sent on-chain → confirmations → `COMPLETED`. Simulate with
`POST /mock/orange/payment/:orderId/event {scenario:PAYMENT_SUCCESS}` then
`POST /mock/crypto/send/:orderId/event {scenario:CONFIRMED}` (admin token).

**SELL USDT** — `POST /quotes {side:SELL_USDT,usdtAmount}` → `POST
/crypto/orders/sell {quoteId,networkId}` → send USDT to the returned deposit
address → confirmations → GNF reserved → Orange payout → `COMPLETED`. Simulate
with `POST /mock/crypto/deposit/:orderId/event {scenario:CONFIRMED}`.

**Event ticket** — `POST /event-orders {eventId,items,currency}` → pay (Orange
for GNF) → tickets issued with signed QR → `POST /scanner/scan
{eventId,gate,qrToken}` at the gate (first valid scan wins; a second scan returns
`ALREADY_USED`).

## Tests

```bash
docker compose -f docker-compose.test.yml up -d      # pg :5433, redis :6380
pnpm --filter @bn/api test        # 25 unit: pricing math, WAC + FIFO COGS,
                                  # ledger balance, QR signing, state machines
pnpm --filter @bn/api test:e2e    # 10 integration: full BUY, full SELL,
                                  # payment failure, deposit mismatch, insufficient
                                  # liquidity, oversell, double-scan, idempotency,
                                  # ledger integrity
```

## Deploy

`deploy/` holds the production stack (Postgres, Redis, api, web, Caddy auto-TLS,
single domain, `/api/*` → API). See `deploy/.env.prod.example`.

```bash
git clone https://github.com/OddoMaxi/bndcoin.git /opt/bndcoin
cd /opt/bndcoin/deploy && cp .env.prod.example .env   # set PUBLIC_URL + secrets
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec api sh -c "cd apps/api && pnpm exec prisma db seed"
```

Migrations apply automatically on API start. Keep `REAL_MONEY_MODE=false`,
`REAL_CRYPTO_MODE=false`, `ORANGE_MODE=mock` until credentials/hardware are ready.

## Security posture

Implemented: phone-OTP + rotating JWT + session revocation, argon2 for the
optional ops passwords, granular RBAC, `Idempotency-Key` enforcement with stored
replay, per-route rate limiting, append-only audit log written in-transaction,
server-side state-machine validation, DB-level oversell protection, signed QR
(HMAC, no raw ids), reconciliation-before-settlement, confirmations-before-payout,
double-entry ledger with integrity checks, secret management via env, address
validation per network.

Scaffolded / deferred to a later iteration: real KYC/AML provider calls and
document storage, daily/monthly velocity-limit *enforcement* (per-tx + daily are
enforced), 2FA for admin console, hardware-backed wallet signing, refund-payout
execution, real SMS/email/push, physical modem serial driver, `www` subdomain.
