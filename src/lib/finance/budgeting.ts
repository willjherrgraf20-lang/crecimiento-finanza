import { db } from "../db";

export async function getMonthlySummary(userId: string, year: number, month: number) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const [expenses, income] = await Promise.all([
    db.expense.aggregate({
      where: { userId, type: "EXPENSE", date: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    db.expense.aggregate({
      where: { userId, type: "INCOME", date: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
  ]);

  const totalExpenses = Number(expenses._sum.amount ?? 0);
  const totalIncome = Number(income._sum.amount ?? 0);

  return {
    totalExpenses,
    totalIncome,
    netSavings: totalIncome - totalExpenses,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
  };
}

export async function getExpensesByCategory(userId: string, from: Date, to: Date) {
  const rows = await db.expense.groupBy({
    by: ["categoryId"],
    where: { userId, type: "EXPENSE", date: { gte: from, lte: to } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  const categories = await db.category.findMany({
    where: { id: { in: rows.map((r) => r.categoryId).filter(Boolean) as string[] } },
  });

  return rows.map((row) => ({
    category: categories.find((c) => c.id === row.categoryId) ?? null,
    total: Number(row._sum.amount ?? 0),
  }));
}
