import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPortfolioSnapshot } from "@/domain/investments/portfolio.service";

export async function GET() {
  try {
    const session = await requireAuth();
    const snapshot = await getPortfolioSnapshot(session.userId);

    // Transform to frontend-expected shape
    const result = {
      totalCost: snapshot.totalCostBasis,
      currentValue: snapshot.totalValue,
      unrealizedPnL: snapshot.totalPnL,
      pnlPct: snapshot.totalPnLPct,
      positions: snapshot.positions.map((p) => ({
        assetId: p.assetId,
        ticker: p.symbol,
        name: p.name,
        assetType: p.type,
        quantity: p.quantity,
        avgCost: p.averagePrice,
        currentPrice: p.currentPrice,
        totalCost: p.costBasis,
        currentValue: p.currentValue,
        unrealizedPnL: p.pnl,
        pnlPct: p.pnlPct,
        currency: "USD",
      })),
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
