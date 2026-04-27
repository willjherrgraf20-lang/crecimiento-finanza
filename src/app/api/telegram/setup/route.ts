import { NextRequest, NextResponse } from "next/server";
import { setWebhook, deleteWebhook } from "@/lib/telegram";

/**
 * POST /api/telegram/setup
 * Registra el webhook de Telegram.
 * Body: { webhookUrl: string }  ← URL pública del servidor
 * Protegido con CRON_SECRET.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { webhookUrl } = await req.json() as { webhookUrl?: string };

    if (!webhookUrl) {
      return NextResponse.json({ error: "webhookUrl es requerido" }, { status: 400 });
    }

    const fullWebhookUrl = `${webhookUrl}/api/telegram/webhook`;
    const ok = await setWebhook(fullWebhookUrl);

    return NextResponse.json({ ok, webhookUrl: fullWebhookUrl });
  } catch (error) {
    console.error("[Telegram Setup]:", error);
    return NextResponse.json({ error: "Error al configurar webhook" }, { status: 500 });
  }
}

/**
 * DELETE /api/telegram/setup
 * Elimina el webhook de Telegram.
 */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  void req;
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const ok = await deleteWebhook();
  return NextResponse.json({ ok });
}
