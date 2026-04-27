import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

const BOT_USERNAME = "OFinanzaBot"; // @OFinanzaBot — FinanzaOdin bot

/**
 * GET /api/telegram/link
 * Genera un token de vinculación y retorna el link de Telegram.
 * Requiere sesión activa.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  void req;
  try {
    const session = await requireAuth();

    // Generar token único de 32 bytes
    const token = randomBytes(32).toString("hex");

    await db.user.update({
      where: { id: session.userId },
      data: { telegramLinkToken: token },
    });

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { telegramChatId: true },
    });

    return NextResponse.json({
      linked: !!user?.telegramChatId,
      telegramUrl: `https://t.me/${BOT_USERNAME}?start=${token}`,
      token,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[Telegram Link] Error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

/**
 * DELETE /api/telegram/link
 * Desvincula la cuenta de Telegram del usuario actual.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  void req;
  try {
    const session = await requireAuth();

    await db.user.update({
      where: { id: session.userId },
      data: { telegramChatId: null, telegramLinkToken: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
