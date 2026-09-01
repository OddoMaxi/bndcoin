import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: ['warn', 'error'] });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to Postgres');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Interactive transaction wrapper. Defaults to ReadCommitted so that the
   * explicit `SELECT ... FOR UPDATE` row locks used by the treasury / state
   * machine produce deterministic blocking (rather than serialization retries).
   */
  runInTransaction<T>(
    fn: (tx: Tx) => Promise<T>,
    opts?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeoutMs?: number },
  ): Promise<T> {
    return this.$transaction(fn, {
      isolationLevel: opts?.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: opts?.timeoutMs ?? 15_000,
    });
  }

  /** Pessimistically lock a Transaction row for the life of `tx`. Returns its status. */
  async lockTransaction(tx: Tx, id: string): Promise<{ id: string; status: string } | null> {
    const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>(
      Prisma.sql`SELECT "id", "status"::text AS "status" FROM "Transaction" WHERE "id" = ${id} FOR UPDATE`,
    );
    return rows[0] ?? null;
  }

  /** Pessimistically lock a TreasuryAccount row by asset. */
  async lockTreasuryAccount(
    tx: Tx,
    asset: 'GNF' | 'USDT',
  ): Promise<{ id: string; asset: string; available: string; reserved: string; version: number } | null> {
    const rows = await tx.$queryRaw<
      Array<{ id: string; asset: string; available: string; reserved: string; version: number }>
    >(
      Prisma.sql`SELECT "id", "asset"::text AS "asset", "available"::text AS "available", "reserved"::text AS "reserved", "version"
                 FROM "TreasuryAccount" WHERE "asset" = ${asset}::"Asset" FOR UPDATE`,
    );
    return rows[0] ?? null;
  }
}
