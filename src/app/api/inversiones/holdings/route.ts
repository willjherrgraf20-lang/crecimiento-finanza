import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  ticker: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  assetType: z.enum(["ETF", "STOCK", "CRYPTO", "BOND", "COMMODITY"]),
  quantity: z.number().positive(),
  avgCostBasis: z.number().positive(),
  currency: z.string().length(3).default("USD"),
});

function mapHolding(h: {
  id: string;
  quantity: { toNumber: () => number };
  averagePrice: { toNumber: () => number };
  asset: { id: string; symbol: string; name: string; type: string; currency: string; prices?: { price: { toNumber: () => number }; asOf: Date }[] };
  currentPrice?: number | null;
}) {
  const prices = h.asset.prices ?? [];
  const latestPrice = prices.length > 0
    ? [...prices].sort((a, b) => new Date(b.asOf).getTime() - new Date(a.asOf).getTime())[0].price.toNumber()
    : (h.currentPrice ?? null);

  return {
    id: h.id,
    quantity: h.quantity.toNumber(),
    avgCostBasis: h.averagePrice.toNumber().toString(),
    currency: h.asset.currency,
    asset: {
      id: h.asset.id,
      ticker: h.asset.symbol,
      name: h.asset.name,
      assetType: h.asset.type,
      currentPrice: latestPrice !== null ? latestPrice.toString() : null,
      currency: h.asset.currency,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const holdings = await db.holding.findMany({
      where: {
        userId: session.userId,
        ...(type && { asset: { type: type as "ETF" | "STOCK" | "CRYPTO" | "BOND" | "COMMODITY" } }),
      },
      include: {
        asset: { include: { prices: { orderBy: { asOf: "desc" }, take: 1 } } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(holdings.map(mapHolding));
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const data = createSchema.parse(body);

    // Find or create the asset
    let asset = await db.asset.findFirst({
      where: { symbol: data.ticker.toUpperCase(), userId: null },
    });
    if (!asset) {
      asset = await db.asset.findFirst({
        where: { symbol: data.ticker.toUpperCase(), userId: session.userId },
      });
    }
    if (!asset) {
      asset = await db.asset.create({
        data: {
          symbol: data.ticker.toUpperCase(),
          name: data.name,
          type: data.assetType,
          currency: data.currency,
          userId: session.userId,
        },
      });
    }

    // Find or create a default account for investments
    let account = await db.account.findFirst({
      where: { userId: session.userId, type: "BROKER" },
    });
    if (!account) {
      account = await db.account.findFirst({ where: { userId: session.userId } });
    }
    if (!account) {
      account = await db.account.create({
        data: {
          userId: session.userId,
          name: "Inversiones",
          type: "BROKER",
          currency: data.currency,
          initialBalance: 0,
        },
      });
    }

    const holding = await db.holding.upsert({
      where: {
        userId_accountId_assetId: {
          userId: session.userId,
          accountId: account.id,
          assetId: asset.id,
        },
      },
      create: {
        userId: session.userId,
        accountId: account.id,
        assetId: asset.id,
        quantity: data.quantity,
        averagePrice: data.avgCostBasis,
      },
      update: {
        quantity: data.quantity,
        averagePrice: data.avgCostBasis,
      },
      include: {
        asset: { include: { prices: { orderBy: { asOf: "desc" }, take: 1 } } },
      },
    });

    return NextResponse.json(mapHolding(holding), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
