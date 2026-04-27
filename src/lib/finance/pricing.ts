import { db } from "@/lib/db";
import { getLatestPricesForAssets, type MarketAsset } from "@/lib/integrations/marketData";

export interface SyncPricesResult {
  updated: number;
  failed: number;
  assetsCount: number;
  details: { symbol: string; price: number | null; ok: boolean }[];
}

export async function syncPricesForAllAssets(options: { userId?: string; assetIds?: string[] } = {}): Promise<SyncPricesResult> {
  const { userId, assetIds } = options;

  const assets = await db.asset.findMany({
    where: {
      ...(userId && { userId }),
      ...(assetIds?.length && { id: { in: assetIds } }),
    },
  });

  if (assets.length === 0) return { updated: 0, failed: 0, assetsCount: 0, details: [] };

  const marketAssets: MarketAsset[] = assets.map((a) => ({
    id: a.id,
    symbol: a.symbol,
    type: a.type as MarketAsset["type"],
    currency: a.currency,
  }));

  const quotes = await getLatestPricesForAssets(marketAssets);
  const fetchedIds = new Set(quotes.map((q) => q.assetId));
  const details: SyncPricesResult["details"] = [];

  if (quotes.length > 0) {
    await db.assetPrice.createMany({
      data: quotes.map((q) => ({
        assetId: q.assetId,
        price: q.price,
        currency: q.currency,
        source: q.source,
        asOf: q.asOf,
      })),
    });
    for (const q of quotes) details.push({ symbol: q.symbol, price: q.price, ok: true });
  }

  for (const asset of assets) {
    if (!fetchedIds.has(asset.id)) {
      details.push({ symbol: asset.symbol, price: null, ok: false });
    }
  }

  return { updated: quotes.length, failed: assets.length - quotes.length, assetsCount: assets.length, details };
}

export async function getCurrentPrice(assetId: string) {
  const latest = await db.assetPrice.findFirst({
    where: { assetId },
    orderBy: { asOf: "desc" },
  });
  if (!latest) return null;
  return { price: latest.price.toNumber(), currency: latest.currency, asOf: latest.asOf, source: latest.source };
}

export async function getPortfolioValue(userId: string) {
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

      return { assetId: h.assetId, symbol: h.asset.symbol, qty, avgPrice, costBasis, currentPrice, currentValue, pnl, pnlPct };
    })
  );

  const totalCurrentValue = positions.reduce((s, p) => s + (p.currentValue ?? 0), 0);
  const totalCostBasis = positions.reduce((s, p) => s + p.costBasis, 0);
  const totalPnl = totalCurrentValue - totalCostBasis;
  const totalPnlPct = totalCostBasis > 0 ? (totalPnl / totalCostBasis) * 100 : 0;

  return { totalCurrentValue, totalCostBasis, totalPnl, totalPnlPct, positions };
}

export async function getPriceHistory(assetId: string, days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const prices = await db.assetPrice.findMany({
    where: { assetId, asOf: { gte: since } },
    orderBy: { asOf: "asc" },
    select: { price: true, asOf: true, source: true },
  });

  return prices.map((p) => ({ price: p.price.toNumber(), asOf: p.asOf, source: p.source }));
}
