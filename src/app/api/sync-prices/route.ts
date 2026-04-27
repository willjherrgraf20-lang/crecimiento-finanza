import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { syncPricesForAllAssets } from "@/lib/finance/pricing";

export async function POST() {
  try {
    const session = await requireAuth();
    const result = await syncPricesForAllAssets({ userId: session.userId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
