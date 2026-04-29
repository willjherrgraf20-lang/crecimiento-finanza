import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getValidAccessToken } from "@/domain/email/gmail.service";

export async function GET() {
  try {
    const session = await requireAuth();

    const token = await db.gmailToken.findUnique({ where: { userId: session.userId } });
    if (!token) {
      return NextResponse.json({ connected: false });
    }

    let emailAddress: string | null = null;
    try {
      const accessToken = await getValidAccessToken(session.userId);
      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json() as { emailAddress?: string };
        emailAddress = data.emailAddress ?? null;
      }
    } catch (e) {
      console.error("[email/status] No se pudo obtener perfil de Gmail:", e);
    }

    return NextResponse.json({
      connected: true,
      emailAddress,
      connectedAt: token.createdAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[email/status] Error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
