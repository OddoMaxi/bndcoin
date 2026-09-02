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
   * Interactive transaction. ReadCommitted + explicit `SELECT ... FOR UPDATE`
   * row locks give deterministic pessimistic blocking for money-critical paths.
   */
  runInTransaction<T>(
    fn: (tx: Tx) => Promise<T>,
    opts?: { isolationLevel?: Prisma.TransactionIsolationLevel; timeoutMs?: number },
  ): Promise<T> {
    return this.$transaction(fn, {
      isolationLevel: opts?.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: opts?.timeoutMs ?? 20_000,
    });
  }

  /** Lock an arbitrary row by id for the life of `tx`. Table name is a trusted constant. */
  async lockRow(tx: Tx, table: string, id: string): Promise<void> {
    await tx.$executeRawUnsafe(`SELECT 1 FROM "${table}" WHERE "id" = $1 FOR UPDATE`, id);
  }

  /** Lock a TreasuryAccount by (asset, bucket) and return its numeric fields as strings. */
  async lockTreasury(
    tx: Tx,
    asset: 'GNF' | 'USDT',
    bucket: string,
  ): Promise<{ id: string; available: string; reserved: string; version: number } | null> {
    const rows = await tx.$queryRaw<
      Array<{ id: string; available: string; reserved: string; version: number }>
    >(
      Prisma.sql`SELECT "id", "available"::text AS "available", "reserved"::text AS "reserved", "version"
                 FROM "TreasuryAccount" WHERE "asset" = ${asset}::"Asset" AND "bucket" = ${bucket} FOR UPDATE`,
    );
    return rows[0] ?? null;
  }
}
