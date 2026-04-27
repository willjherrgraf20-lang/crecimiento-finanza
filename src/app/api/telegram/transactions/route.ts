import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/telegram/transactions
 * Retorna las TelegramTransactions del usuario autenticado.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  void req;
  try {
    const session = await requireAuth();

    const transactions = await db.telegramTransaction.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(transactions);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
