import { db } from "@/lib/db";
import { enrichHolding } from "./holding.entity";
import { getCurrentPrice } from "@/lib/finance/pricing";
import type { CreateHoldingInput, UpdateHoldingInput } from "@/lib/validators/investmentSchema";
import type { InvestmentTxType } from "@prisma/client";
import type { PortfolioSnapshot } from "./investment.types";

export async function getPortfolio(userId: string) {
  const holdings = await db.holding.findMany({
    where: { userId },
    include: {
      asset: { include: { prices: { orderBy: { asOf: "desc" }, take: 90 } } },
      account: { select: { id: true, name: true, type: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return holdings.map(enrichHolding);
}

export async function createHolding(userId: string, input: CreateHoldingInput & { accountId: string }) {
  let asset = await db.asset.findFirst({ where: { symbol: input.ticker, userId: null } });
  if (!asset) asset = await db.asset.findFirst({ where: { symbol: input.ticker, userId } });
  if (!asset) {
    asset = await db.asset.create({
      data: { symbol: input.ticker, name: input.name, type: input.type, currency: input.currency ?? "USD", userId },
    });
  }

  return db.holding.upsert({
    where: { userId_accountId_assetId: { userId, accountId: input.accountId, assetId: asset.id } },
    create: { userId, accountId: input.accountId, assetId: asset.id, quantity: input.quantity, averagePrice: input.avgCost },
    update: { quantity: input.quantity, averagePrice: input.avgCost },
    include: { asset: true, account: true },
  });
}

export async function updateHolding(userId: string, id: string, input: UpdateHoldingInput) {
  const existing = await db.holding.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Not found");
  return db.holding.update({
    where: { id },
    data: {
      ...(input.quantity !== undefined && { quantity: input.quantity }),
      ...(input.avgCost !== undefined && { averagePrice: input.avgCost }),
    },
    include: { asset: true },
  });
}

export async function deleteHolding(userId: string, id: string) {
  const existing = await db.holding.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Not found");
  return db.holding.delete({ where: { id } });
}

export async function createTrade(userId: string, input: {
  accountId: string; assetId: string; type: InvestmentTxType;
  quantity?: number; price?: number; fee?: number;
  totalAmount: number; currency?: string; tradeDate: string; notes?: string;
}) {
  const trade = await db.investmentTransaction.create({
    data: {
      userId,
      accountId: input.accountId,
      assetId: input.assetId,
      type: input.type,
      quantity: input.quantity,
      price: input.price,
      fee: input.fee ?? 0,
      totalAmount: input.totalAmount,
      currency: input.currency ?? "USD",
      tradeDate: new Date(input.tradeDate),
      notes: input.notes,
    },
    include: { asset: true, account: true },
  });

  if (input.type === "BUY" || input.type === "SELL") {
    await recalcHolding(userId, input.accountId, input.assetId);
  }

  return trade;
}

export async function listTrades(userId: string, assetId?: string) {
  return db.investmentTransaction.findMany({
    where: { userId, ...(assetId && { assetId }) },
    include: { asset: true, account: true },
    orderBy: { tradeDate: "desc" },
  });
}

async function recalcHolding(userId: string, accountId: string, assetId: string) {
  const buys = await db.investmentTransaction.findMany({ where: { userId, accountId, assetId, type: "BUY" } });
  const sells = await db.investmentTransaction.findMany({ where: { userId, accountId, assetId, type: "SELL" } });

  const totalBuyQty = buys.reduce((s, t) => s + (t.quantity?.toNumber() ?? 0), 0);
  const totalSellQty = sells.reduce((s, t) => s + (t.quantity?.toNumber() ?? 0), 0);
  const netQty = totalBuyQty - totalSellQty;
  const totalCost = buys.reduce((s, t) => s + (t.quantity?.toNumber() ?? 0) * (t.price?.toNumber() ?? 0), 0);
  const avgPrice = totalBuyQty > 0 ? totalCost / totalBuyQty : 0;

  await db.holding.upsert({
    where: { userId_accountId_assetId: { userId, accountId, assetId } },
    create: { userId, accountId, assetId, quantity: netQty, averagePrice: avgPrice },
    update: { quantity: netQty, averagePrice: avgPrice },
  });
}

export async function getPortfolioSnapshot(userId: string): Promise<PortfolioSnapshot> {
  const holdings = await db.holding.findMany({ where: { userId }, include: { asset: true } });

  const positions = await Promise.all(
    holdings.map(async (h) => {
      const qty = h.quantity.toNumber();
      const avgPrice = h.averagePrice.toNumber();
      const costBasis = qty * avgPrice;
      const latest = await getCurrentPrice(h.assetId);
      const currentPrice = latest?.price ?? null;
      const currentValue = currentPrice !== null ? qty * currentPrice : null;
      const pnl = currentValue !== null ? currentValue - costBasis : null;
      const pnlPct = pnl !== null && costBasis > 0 ? (pnl / costBasis) * 100 : null;

      return { assetId: h.assetId, holdingId: h.id, symbol: h.asset.symbol, name: h.asset.name, type: h.asset.type, quantity: qty, averagePrice: avgPrice, currentPrice, currentValue, costBasis, pnl, pnlPct };
    })
  );

  const totalValue = positions.reduce((s, p) => s + (p.currentValue ?? 0), 0);
  const totalCostBasis = positions.reduce((s, p) => s + p.costBasis, 0);
  const totalPnL = totalValue - totalCostBasis;

  return {
    asOf: new Date(),
    totalValue,
    totalCostBasis,
    totalPnL,
    totalPnLPct: totalCostBasis > 0 ? (totalPnL / totalCostBasis) * 100 : 0,
    positions,
  };
}
