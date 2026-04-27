import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listAccounts, createAccount } from "@/domain/accounts/account.service";
import { createAccountSchema } from "@/lib/validators/accountSchema";
import { z } from "zod";

export async function GET() {
  try {
    const session = await requireAuth();
    const accounts = await listAccounts(session.userId);
    return NextResponse.json(accounts);
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
    const data = createAccountSchema.parse(body);
    const account = await createAccount(session.userId, data);
    return NextResponse.json(account, { status: 201 });
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
