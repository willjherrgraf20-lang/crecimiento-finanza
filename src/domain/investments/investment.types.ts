import type { InvestmentTxType } from "@prisma/client";

export interface AddTradeInput {
  userId: string;
  accountId: string;
  assetId: string;
  type: InvestmentTxType;
  quantity?: number;
  price?: number;
  fee?: number;
  totalAmount: number;
  currency?: string;
  tradeDate: Date;
  notes?: string;
}

export interface PortfolioPosition {
  assetId: string;
  holdingId: string;
  symbol: string;
  name: string;
  type: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number | null;
  currentValue: number | null;
  costBasis: number;
  pnl: number | null;
  pnlPct: number | null;
}

export interface PortfolioSnapshot {
  asOf: Date;
  totalValue: number;
  totalCostBasis: number;
  totalPnL: number;
  totalPnLPct: number;
  positions: PortfolioPosition[];
}
