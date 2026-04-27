import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().uuid().optional().nullable(),
  amountLimit: z.number().positive(),
  currency: z.string().length(3).default("CLP"),
  periodType: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  periodYear: z.number().int().default(new Date().getFullYear()),
  periodMonth: z.number().int().min(1).max(12).optional().nullable(),
});

export async function GET() {
  try {
    const session = await requireAuth();
    const budgets = await db.budget.findMany({
      where: { userId: session.userId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(budgets);
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

    const budget = await db.budget.create({
      data: {
        userId: session.userId,
        name: data.name,
        categoryId: data.categoryId ?? null,
        amountLimit: data.amountLimit,
        currency: data.currency,
        periodType: data.periodType,
        periodYear: data.periodYear,
        periodMonth: data.periodMonth ?? null,
      },
      include: { category: true },
    });
    return NextResponse.json(budget, { status: 201 });
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
