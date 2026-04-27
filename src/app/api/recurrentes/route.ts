import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3).default("CLP"),
  type: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
  categoryId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid(),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY"]),
  nextDueDate: z.string().datetime(),
});

export async function GET() {
  try {
    const session = await requireAuth();
    const recurring = await db.recurringExpense.findMany({
      where: { userId: session.userId },
      include: { category: true, account: true },
      orderBy: { nextDueDate: "asc" },
    });
    return NextResponse.json(recurring);
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
    const data = createSchema.parse(body);

    const recurring = await db.recurringExpense.create({
      data: {
        userId: session.userId,
        name: data.name,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        categoryId: data.categoryId ?? null,
        accountId: data.accountId,
        frequency: data.frequency,
        nextDueDate: new Date(data.nextDueDate),
        isActive: true,
      },
      include: { category: true, account: true },
    });
    return NextResponse.json(recurring, { status: 201 });
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
