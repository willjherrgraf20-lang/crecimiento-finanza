import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { scanBankEmails } from "@/domain/email/gmail.service";

export async function POST() {
  try {
    const session = await requireAuth();
    const result = await scanBankEmails(session.userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith("Gmail no conectado")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[scan POST] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await requireAuth();
    const { db } = await import("@/lib/db");

    const gmailToken = await db.gmailToken.findUnique({ where: { userId: session.userId } });
    if (!gmailToken) {
      return NextResponse.json({ error: "Gmail no conectado" }, { status: 400 });
    }

    const emails = await db.emailTransaction.findMany({
      where: { userId: session.userId, status: "PENDING" },
      orderBy: { receivedAt: "desc" },
      take: 50,
    });
    return NextResponse.json(emails);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
