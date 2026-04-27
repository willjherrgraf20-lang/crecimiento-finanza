import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createExpense } from "@/domain/expenses/expense.service";
import { db } from "@/lib/db";
import { z } from "zod";

const confirmSchema = z.object({
  emailTransactionId: z.string().uuid(),
  accountId: z.string().uuid(),
  categoryId: z.string().optional().nullable(),
  amount: z.number().positive(),
  type: z.enum(["EXPENSE", "INCOME"]),
  description: z.string().optional(),
  currency: z.string().length(3).default("CLP"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const data = confirmSchema.parse(body);

    // Verificar que la EmailTransaction pertenece al usuario y está PENDING
    const emailTx = await db.emailTransaction.findFirst({
      where: { id: data.emailTransactionId, userId: session.userId, status: "PENDING" },
    });

    if (!emailTx) {
      return NextResponse.json({ error: "Email transaction no encontrada" }, { status: 404 });
    }

    // Crear el gasto/ingreso
    const expense = await createExpense({
      userId: session.userId,
      accountId: data.accountId,
      categoryId: data.categoryId,
      amount: data.amount,
      type: data.type,
      description: data.description ?? emailTx.parsedDesc ?? emailTx.rawSubject,
      date: emailTx.parsedDate ?? emailTx.receivedAt,
      currency: data.currency,
    });

    // Actualizar el EmailTransaction a CONFIRMED
    await db.emailTransaction.update({
      where: { id: emailTx.id },
      data: { status: "CONFIRMED", expenseId: expense.id },
    });

    return NextResponse.json({ ok: true, expense });
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

// Rechazar una EmailTransaction
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { id } = await req.json();

    const emailTx = await db.emailTransaction.findFirst({
      where: { id, userId: session.userId, status: "PENDING" },
    });

    if (!emailTx) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    await db.emailTransaction.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
