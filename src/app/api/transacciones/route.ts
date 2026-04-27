import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { listExpenses, createExpense, createExpenseApiSchema } from "@/domain/expenses/expense.service";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : undefined;
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : undefined;
    const accountId = searchParams.get("accountId") ?? undefined;
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const type = searchParams.get("type") as "EXPENSE" | "INCOME" | "TRANSFER" | undefined;
    const search = searchParams.get("search") ?? undefined;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;
    const offset = searchParams.get("offset") ? Number(searchParams.get("offset")) : 0;

    const result = await listExpenses({ userId: session.userId, from, to, accountId, categoryId, type, search, limit, offset });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const data = createExpenseApiSchema.parse(body);

    const expense = await createExpense({
      userId: session.userId,
      accountId: data.accountId,
      categoryId: data.categoryId,
      amount: data.amount,
      type: data.type,
      description: data.description,
      date: new Date(data.date),
      notes: data.notes,
      currency: data.currency,
    });

    return NextResponse.json(expense, { status: 201 });
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
