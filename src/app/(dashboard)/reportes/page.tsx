"use client";

import { useEffect, useState } from "react";
import { Download, BarChart2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateShort } from "@/lib/utils/date";

interface MonthSummary {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

interface Expense {
  id: string;
  amount: string;
  type: string;
  description: string | null;
  date: string;
  currency: string;
  account: { name: string };
  category: { name: string } | null;
}

function buildMonthlyData(expenses: Expense[]): MonthSummary[] {
  const map: Record<string, MonthSummary> = {};
  for (const e of expenses) {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map[key]) map[key] = { month: key, income: 0, expenses: 0, net: 0 };
    const amt = parseFloat(e.amount);
    if (e.type === "INCOME") map[key].income += amt;
    else map[key].expenses += amt;
  }
  return Object.values(map)
    .map((m) => ({ ...m, net: m.income - m.expenses }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12);
}

function exportCSV(expenses: Expense[]) {
  const header = "Fecha,Tipo,Descripción,Cuenta,Categoría,Monto,Moneda\n";
  const rows = expenses.map((e) =>
    [
      formatDateShort(new Date(e.date)),
      e.type === "INCOME" ? "Ingreso" : "Gasto",
      `"${e.description ?? ""}"`,
      e.account.name,
      e.category?.name ?? "",
      parseFloat(e.amount).toFixed(2),
      e.currency,
    ].join(",")
  );
  const csv = header + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transacciones_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const from = new Date(year, 0, 1).toISOString();
    const to = new Date(year, 11, 31, 23, 59, 59).toISOString();
    fetch(`/api/transacciones?from=${from}&to=${to}&limit=500`)
      .then((r) => r.json())
      .then((d) => setExpenses(Array.isArray(d) ? d : (d.items ?? [])))
      .finally(() => setLoading(false));
  }, [year]);

  const monthly = buildMonthlyData(expenses);
  const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
  const totalExpenses = monthly.reduce((s, m) => s + m.expenses, 0);
  const totalNet = totalIncome - totalExpenses;

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Reportes</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Resumen anual de finanzas</p>
        </div>
        <div className="flex gap-2">
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => exportCSV(expenses)}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {/* Annual summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Ingresos {year}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[var(--color-gain)]">
            {formatCurrency(totalIncome, "CLP")}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Gastos {year}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[var(--color-loss)]">
            {formatCurrency(totalExpenses, "CLP")}
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${
          totalNet >= 0
            ? "border-[var(--color-gain-subtle)] bg-[var(--color-gain-subtle)]/30"
            : "border-[var(--color-loss-subtle)] bg-[var(--color-loss-subtle)]/30"
        }`}>
          <p className="text-xs text-[var(--color-text-secondary)]">Neto {year}</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${totalNet >= 0 ? "text-[var(--color-gain)]" : "text-[var(--color-loss)]"}`}>
            {formatCurrency(totalNet, "CLP")}
          </p>
        </div>
      </div>

      {/* Monthly table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : monthly.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] gap-2">
          <BarChart2 className="h-8 w-8 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">Sin datos para {year}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Mes</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Ingresos</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Gastos</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Neto</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Balance</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => {
                const [y, mo] = m.month.split("-");
                const label = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
                const isPositive = m.net >= 0;
                const maxVal = Math.max(...monthly.map((x) => Math.max(x.income, x.expenses)));
                const barPct = maxVal > 0 ? (Math.abs(m.net) / maxVal) * 100 : 0;
                return (
                  <tr key={m.month} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)]">
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)] capitalize">{label}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-gain)]">
                      {formatCurrency(m.income, "CLP")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-loss)]">
                      {formatCurrency(m.expenses, "CLP")}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${isPositive ? "text-[var(--color-gain)]" : "text-[var(--color-loss)]"}`}>
                      {isPositive ? "+" : ""}{formatCurrency(m.net, "CLP")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <div className="h-2 w-24 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${barPct}%`,
                              backgroundColor: isPositive ? "var(--color-gain)" : "var(--color-loss)",
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
