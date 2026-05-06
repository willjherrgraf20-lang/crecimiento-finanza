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
  currency: z.string().min(2).max(10).default("CLP"),
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

    // Idempotencia: si ya existe Expense con el mismo transactionId, no duplicar.
    // Marca el EmailTransaction como CONFIRMED apuntando al Expense existente.
    if (emailTx.transactionId) {
      const existing = await db.expense.findUnique({
        where: { user_transaction_unique: { userId: session.userId, transactionId: emailTx.transactionId } },
      });
      if (existing) {
        await db.emailTransaction.update({
          where: { id: emailTx.id },
          data: { status: "CONFIRMED", expenseId: existing.id },
        });
        return NextResponse.json({
          ok: true,
          expense: existing,
          duplicate: true,
          message: "Este movimiento ya estaba registrado. Se vinculó el email al expense existente.",
        });
      }
    }

    // Crear el gasto/ingreso con la metadata extraída del email
    const expense = await createExpense({
      userId: session.userId,
      accountId: data.accountId,
      categoryId: data.categoryId,
      amount: data.amount,
      type: data.type,
      description: data.description ?? emailTx.parsedDesc ?? emailTx.rawSubject,
      date: emailTx.parsedDate ?? emailTx.receivedAt,
      currency: data.currency,
      transactionId: emailTx.transactionId,
      counterpartyName: emailTx.counterpartyName,
      counterpartyRut: emailTx.counterpartyRut,
      counterpartyAccount: emailTx.counterpartyAccount,
      counterpartyBank: emailTx.counterpartyBank,
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
      const msg = error.issues.map((i) => i.message).join(", ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[email/confirm] Error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

// Endpoint auxiliar para sugerir cuenta auto-asociada por número (paridad con bot Telegram).
// El frontend lo puede llamar después de fetchear el EmailTransaction para pre-seleccionar
// la cuenta cuando se detecta match en owner_account.
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const url = new URL(req.url);
    const emailTxId = url.searchParams.get("emailTransactionId");
    if (!emailTxId) {
      return NextResponse.json({ error: "emailTransactionId requerido" }, { status: 400 });
    }

    const emailTx = await db.emailTransaction.findFirst({
      where: { id: emailTxId, userId: session.userId },
    });
    if (!emailTx) return NextResponse.json({ matchedAccountId: null });
    if (!emailTx.ownerAccount) return NextResponse.json({ matchedAccountId: null });

    // Normalizar (quitar no-numéricos y ceros a la izquierda) para tolerar variantes
    const target = emailTx.ownerAccount.replace(/\D/g, "").replace(/^0+/, "");
    if (!target) return NextResponse.json({ matchedAccountId: null });

    const accounts = await db.account.findMany({ where: { userId: session.userId } });
    const matched = accounts.find((acc) => {
      const norm = (acc.accountNumber ?? "").replace(/\D/g, "").replace(/^0+/, "");
      return norm && norm === target;
    });

    return NextResponse.json({ matchedAccountId: matched?.id ?? null });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    console.error("[email/confirm GET] Error:", error);
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
