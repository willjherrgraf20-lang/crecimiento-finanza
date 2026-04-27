import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listTrades, createTrade } from "@/domain/investments/portfolio.service";
import { addTradeSchema } from "@/lib/validators/investmentSchema";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const assetId = new URL(req.url).searchParams.get("assetId") ?? undefined;
    const trades = await listTrades(session.userId, assetId);
    return NextResponse.json(trades);
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
    const data = addTradeSchema.parse(body);
    const trade = await createTrade(session.userId, data);
    return NextResponse.json(trade, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
