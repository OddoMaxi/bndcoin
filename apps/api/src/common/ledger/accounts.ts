import { Asset, LedgerNormalSide } from '@prisma/client';

export interface AccountDef {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE' | 'EQUITY';
  currency: Asset;
  normalSide: LedgerNormalSide;
}

const asset = (code: string, name: string, currency: Asset): AccountDef => ({
  code,
  name,
  type: 'ASSET',
  currency,
  normalSide: 'DEBIT',
});
const liability = (code: string, name: string, currency: Asset): AccountDef => ({
  code,
  name,
  type: 'LIABILITY',
  currency,
  normalSide: 'CREDIT',
});
const revenue = (code: string, name: string, currency: Asset): AccountDef => ({
  code,
  name,
  type: 'REVENUE',
  currency,
  normalSide: 'CREDIT',
});
const expense = (code: string, name: string, currency: Asset): AccountDef => ({
  code,
  name,
  type: 'EXPENSE',
  currency,
  normalSide: 'DEBIT',
});

export const CHART_OF_ACCOUNTS: AccountDef[] = [
  asset('ASSET_GNF', 'GNF assets (aggregate)', 'GNF'),
  asset('GNF_PDV_01', 'Orange Money PDV 01 float', 'GNF'),
  asset('GNF_PDV_02', 'Orange Money PDV 02 float', 'GNF'),
  asset('GNF_CASH_CLEARING', 'GNF in-flight / clearing', 'GNF'),
  asset('ASSET_USDT', 'USDT assets (aggregate)', 'USDT'),
  asset('USDT_HOT_WALLET', 'USDT hot wallet', 'USDT'),
  asset('USDT_COLD_STORAGE', 'USDT cold storage', 'USDT'),
  asset('USDT_IN_TRANSIT', 'USDT in transit (on-chain, unconfirmed)', 'USDT'),
  asset('USDT_INVENTORY', 'USDT inventory (cost basis carrier)', 'USDT'),
  liability('CUSTOMER_FUNDS', 'Customer funds payable', 'GNF'),
  liability('CUSTOMER_FUNDS_USDT', 'Customer funds payable (USDT)', 'USDT'),
  liability('ORGANIZER_PAYABLE', 'Organizer settlement payable', 'GNF'),
  revenue('PLATFORM_REVENUE', 'Platform revenue', 'GNF'),
  revenue('FEES_REVENUE', 'Fees revenue', 'GNF'),
  revenue('TRADING_MARGIN', 'Crypto trading realized margin', 'GNF'),
  expense('COGS_USDT', 'Cost of USDT sold', 'GNF'),
  expense('TREASURY_ADJUSTMENT', 'Treasury manual adjustment', 'GNF'),
  expense('TREASURY_ADJUSTMENT_USDT', 'Treasury manual adjustment (USDT)', 'USDT'),
];

export type AccountCode = string;
