import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  amountLimit: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  periodType: z.enum(["MONTHLY", "YEARLY"]).optional(),
  periodYear: z.number().int().optional(),
  periodMonth: z.number().int().min(1).max(12).nullable().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await db.budget.findFirst({ where: { id, userId: session.userId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const updated = await db.budget.update({ where: { id }, data, include: { category: true } });
    return NextResponse.json(updated);
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const existing = await db.budget.findFirst({ where: { id, userId: session.userId } });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    await db.budget.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
