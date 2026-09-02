import { Injectable, Logger } from '@nestjs/common';
import { Asset, LedgerDirection } from '@prisma/client';
import { Money } from '@bn/money';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { DomainError } from '../errors/domain-errors';
import { CHART_OF_ACCOUNTS } from './accounts';

export interface JournalLine {
  account: string; // account code
  currency: string; // Asset
  direction: string; // LedgerDirection
  amount: string;
}

export interface PostJournalInput {
  reference: string;
  referenceType: string;
  referenceId: string;
  memo?: string;
  createdBy?: string;
  lines: JournalLine[];
}

export class UnbalancedJournalError extends DomainError {
  constructor(detail: string) {
    super('UNBALANCED_JOURNAL', `Journal does not balance: ${detail}`, 500);
  }
}

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensureChartOfAccounts(): Promise<void> {
    for (const a of CHART_OF_ACCOUNTS) {
      await this.prisma.ledgerAccount.upsert({
        where: { code: a.code },
        update: { name: a.name, type: a.type, currency: a.currency, normalSide: a.normalSide },
        create: a,
      });
    }
  }

  private async accountId(tx: Tx, code: string): Promise<string> {
    const acc = await tx.ledgerAccount.findUnique({ where: { code }, select: { id: true } });
    if (!acc) throw new DomainError('UNKNOWN_ACCOUNT', `Ledger account ${code} does not exist`, 500);
    return acc.id;
  }

  /**
   * Post a balanced double-entry journal. Every currency present in `lines` must
   * have equal debits and credits. Runs in the caller's transaction so it
   * commits atomically with the business change.
   */
  async post(tx: Tx, input: PostJournalInput): Promise<string> {
    if (input.lines.length < 2) {
      throw new UnbalancedJournalError('a journal needs at least two lines');
    }

    const byCurrency = new Map<Asset, { debit: Money; credit: Money }>();
    for (const line of input.lines) {
      const currency = line.currency as Asset;
      const bucket = byCurrency.get(currency) ?? {
        debit: Money.zero(currency),
        credit: Money.zero(currency),
      };
      const amt = Money.of(line.amount, currency).assertPositive('journal line amount');
      if (line.direction === 'DEBIT') bucket.debit = bucket.debit.add(amt);
      else bucket.credit = bucket.credit.add(amt);
      byCurrency.set(currency, bucket);
    }
    for (const [currency, { debit, credit }] of byCurrency) {
      if (!debit.eq(credit)) {
        throw new UnbalancedJournalError(
          `${currency}: debit ${debit.toString()} != credit ${credit.toString()}`,
        );
      }
    }

    const journal = await tx.ledgerJournal.create({
      data: {
        reference: input.reference,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        memo: input.memo,
        createdBy: input.createdBy,
      },
    });

    for (const line of input.lines) {
      await tx.ledgerEntry.create({
        data: {
          journalId: journal.id,
          accountId: await this.accountId(tx, line.account),
          currency: line.currency as Asset,
          direction: line.direction as LedgerDirection,
          amount: Money.of(line.amount, line.currency as Asset).toString(),
        },
      });
    }

    return journal.id;
  }

  /** Balance of one account in its own normal-side sign. */
  async balance(code: string): Promise<string> {
    const acc = await this.prisma.ledgerAccount.findUnique({ where: { code } });
    if (!acc) throw new DomainError('UNKNOWN_ACCOUNT', `Ledger account ${code}`, 500);
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['direction'],
      where: { accountId: acc.id },
      _sum: { amount: true },
    });
    const debit = Money.of(
      grouped.find((g) => g.direction === 'DEBIT')?._sum.amount?.toFixed() ?? '0',
      acc.currency,
    );
    const credit = Money.of(
      grouped.find((g) => g.direction === 'CREDIT')?._sum.amount?.toFixed() ?? '0',
      acc.currency,
    );
    const net = acc.normalSide === 'DEBIT' ? debit.sub(credit) : credit.sub(debit);
    return net.toString();
  }

  async trialBalance(): Promise<
    Array<{ code: string; name: string; currency: Asset; type: string; balance: string }>
  > {
    const accounts = await this.prisma.ledgerAccount.findMany({ orderBy: { code: 'asc' } });
    const out = [];
    for (const a of accounts) {
      out.push({
        code: a.code,
        name: a.name,
        currency: a.currency,
        type: a.type,
        balance: await this.balance(a.code),
      });
    }
    return out;
  }

  /** Global integrity: total debits must equal total credits per currency. */
  async integrityCheck(): Promise<{ ok: boolean; perCurrency: Record<string, { debit: string; credit: string }> }> {
    const grouped = await this.prisma.ledgerEntry.groupBy({
      by: ['currency', 'direction'],
      _sum: { amount: true },
    });
    const perCurrency: Record<string, { debit: string; credit: string }> = {};
    let ok = true;
    for (const currency of ['GNF', 'USDT'] as Asset[]) {
      const d = Money.of(
        grouped.find((g) => g.currency === currency && g.direction === 'DEBIT')?._sum.amount?.toFixed() ?? '0',
        currency,
      );
      const c = Money.of(
        grouped.find((g) => g.currency === currency && g.direction === 'CREDIT')?._sum.amount?.toFixed() ?? '0',
        currency,
      );
      perCurrency[currency] = { debit: d.toString(), credit: c.toString() };
      if (!d.eq(c)) ok = false;
    }
    return { ok, perCurrency };
  }
}
