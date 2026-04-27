import type { Asset, AssetPrice, Holding } from "@prisma/client";
import { calcROI } from "@/lib/finance/metrics";

export type HoldingWithAsset = Holding & {
  asset: Asset & { prices: AssetPrice[] };
};

export function getLatestPrice(holding: HoldingWithAsset): number | null {
  if (!holding.asset.prices.length) return null;
  return [...holding.asset.prices].sort(
    (a, b) => new Date(b.asOf).getTime() - new Date(a.asOf).getTime()
  )[0].price.toNumber();
}

export function enrichHolding(holding: HoldingWithAsset) {
  const currentPrice = getLatestPrice(holding);
  const avgCost = holding.averagePrice.toNumber();
  const qty = holding.quantity.toNumber();
  const roi = currentPrice !== null ? calcROI(currentPrice, avgCost, qty) : null;
  return { ...holding, currentPrice, roi };
}
