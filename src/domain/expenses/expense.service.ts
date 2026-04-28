import { db } from "@/lib/db";
import { inferCategory } from "@/lib/finance/categorization";
import type { ExpenseType } from "@prisma/client";
import { z } from "zod";

export interface CreateExpenseInput {
  userId: string;
  accountId: string;
  categoryId?: string | null;
  amount: number;
  type: ExpenseType;
  description?: string | null;
  date: Date;
  notes?: string | null;
  currency?: string;
}

export interface UpdateExpenseInput {
  id: string;
  userId: string;
  accountId?: string;
  categoryId?: string | null;
  amount?: number;
  type?: ExpenseType;
  description?: string | null;
  date?: Date;
  notes?: string | null;
}

export interface ListExpensesFilters {
  userId: string;
  from?: Date;
  to?: Date;
  accountId?: string;
  categoryId?: string;
  type?: ExpenseType;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getExpenseById(userId: string, id: string) {
  return db.expense.findFirst({
    where: { id, userId },
    include: { category: true, account: true },
  });
}

export async function createExpense(input: CreateExpenseInput) {
  const categoryId =
    input.categoryId !== undefined
      ? input.categoryId
      : input.description
        ? inferCategory(input.description)
        : null;

  return db.expense.create({
    data: {
      userId: input.userId,
      accountId: input.accountId,
      categoryId,
      amount: input.amount,
      type: input.type,
      description: input.description,
      date: input.date,
      notes: input.notes,
      currency: input.currency ?? "CLP",
    },
    include: { category: true, account: true },
  });
}

export async function updateExpense(input: UpdateExpenseInput) {
  const existing = await db.expense.findFirst({ where: { id: input.id, userId: input.userId } });
  if (!existing) throw new Error("Not found");

  const { id, userId, ...data } = input;
  void userId;

  return db.expense.update({
    where: { id },
    data: {
      ...(data.accountId !== undefined && { accountId: data.accountId }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.date !== undefined && { date: data.date }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: { category: true, account: true },
  });
}

export async function deleteExpense(userId: string, id: string) {
  const existing = await db.expense.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Not found");
  return db.expense.delete({ where: { id } });
}

export async function listExpenses(filters: ListExpensesFilters) {
  const { userId, from, to, accountId, categoryId, type, search, limit = 50, offset = 0 } = filters;

  const where = {
    userId,
    ...(from || to ? { date: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    ...(accountId && { accountId }),
    ...(categoryId && { categoryId }),
    ...(type && { type }),
    ...(search && { description: { contains: search, mode: "insensitive" as const } }),
  };

  const [items, total] = await Promise.all([
    db.expense.findMany({
      where,
      include: { category: true, account: true },
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    }),
    db.expense.count({ where }),
  ]);

  return { items, total, limit, offset, pages: Math.ceil(total / limit) };
}

export const createExpenseApiSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().optional().nullable(),
  amount: z.number().positive(),
  type: z.enum(["EXPENSE", "INCOME", "TRANSFER"]),
  description: z.string().max(255).optional().nullable(),
  date: z.string().datetime(),
  notes: z.string().max(1000).optional().nullable(),
  currency: z.string().min(2).max(10).default("CLP"),
});

export const updateExpenseApiSchema = createExpenseApiSchema
  .omit({ accountId: true })
  .extend({ accountId: z.string().uuid().optional() })
  .partial();
