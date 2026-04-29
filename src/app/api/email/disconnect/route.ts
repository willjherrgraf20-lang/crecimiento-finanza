import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST() {
  try {
    const session = await requireAuth();

    await db.gmailToken.deleteMany({ where: { userId: session.userId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[email/disconnect] Error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
