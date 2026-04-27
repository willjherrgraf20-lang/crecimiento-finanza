export interface PricePoint {
  date: Date;
  price: number;
}

export function calcROI(currentPrice: number, avgCost: number, quantity: number) {
  const costBasis = avgCost * quantity;
  const currentValue = currentPrice * quantity;
  const pnl = currentValue - costBasis;
  const roiPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  return { costBasis, currentValue, pnl, roiPct };
}

export function calcTWR(pricePoints: PricePoint[]): number {
  if (pricePoints.length < 2) return 0;
  let twr = 1;
  for (let i = 1; i < pricePoints.length; i++) {
    twr *= pricePoints[i].price / pricePoints[i - 1].price;
  }
  return (twr - 1) * 100;
}

export function calcMaxDrawdown(pricePoints: PricePoint[]): number {
  let peak = -Infinity;
  let maxDD = 0;
  for (const { price } of pricePoints) {
    if (price > peak) peak = price;
    const dd = (peak - price) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

export function calcVolatility(pricePoints: PricePoint[]): number {
  if (pricePoints.length < 2) return 0;
  const returns: number[] = [];
  for (let i = 1; i < pricePoints.length; i++) {
    returns.push(Math.log(pricePoints[i].price / pricePoints[i - 1].price));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function pct(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}
