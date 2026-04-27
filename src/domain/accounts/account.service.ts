import { db } from "@/lib/db";
import type { CreateAccountInput, UpdateAccountInput } from "@/lib/validators/accountSchema";

export async function listAccounts(userId: string) {
  return db.account.findMany({ where: { userId }, orderBy: { name: "asc" } });
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  return db.account.create({ data: { ...input, userId } });
}

export async function updateAccount(userId: string, id: string, input: UpdateAccountInput) {
  const existing = await db.account.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Not found");
  return db.account.update({ where: { id }, data: input });
}

export async function deleteAccount(userId: string, id: string) {
  const existing = await db.account.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Not found");
  return db.account.delete({ where: { id } });
}

export async function getAccountBalance(userId: string, accountId: string): Promise<number> {
  const account = await db.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new Error("Not found");

  const [incomeAgg, expenseAgg] = await Promise.all([
    db.expense.aggregate({
      where: { userId, accountId, type: "INCOME" },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { userId, accountId, type: { in: ["EXPENSE", "TRANSFER"] } },
      _sum: { amount: true },
    }),
  ]);

  const income = Number(incomeAgg._sum.amount ?? 0);
  const expense = Number(expenseAgg._sum.amount ?? 0);

  return Number(account.initialBalance) + income - expense;
}
