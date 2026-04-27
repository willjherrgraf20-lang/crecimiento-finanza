"use client";

import { useEffect, useState } from "react";
import { TrendingUp, ArrowDownLeft, ArrowUpRight, DollarSign } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { formatCurrency } from "@/lib/utils/currency";

interface Summary {
  income: number;
  expenses: number;
  net: number;
}

interface PortfolioSummary {
  currentValue: number;
  pnlPct: number;
}

interface Account {
  id: string;
  initialBalance: string;
  currency: string;
}

function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  return { from, to };
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>({ income: 0, expenses: 0, net: 0 });
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { from, to } = getMonthRange();
      try {
        const [txRes, accRes, portRes] = await Promise.all([
          fetch(`/api/transacciones?from=${from}&to=${to}&limit=500`),
          fetch("/api/cuentas"),
          fetch("/api/inversiones/portafolio"),
        ]);

        if (txRes.ok) {
          const d = await txRes.json();
          const items = d.items ?? d;
          const income = items.filter((e: { type: string }) => e.type === "INCOME")
            .reduce((s: number, e: { amount: string }) => s + parseFloat(e.amount), 0);
          const expenses = items.filter((e: { type: string }) => e.type === "EXPENSE")
            .reduce((s: number, e: { amount: string }) => s + parseFloat(e.amount), 0);
          setSummary({ income, expenses, net: income - expenses });
        }

        if (accRes.ok) {
          const accounts: Account[] = await accRes.json();
          const clpTotal = accounts
            .filter((a) => a.currency === "CLP")
            .reduce((s, a) => s + parseFloat(a.initialBalance), 0);
          setTotalBalance(clpTotal);
        }

        if (portRes.ok) {
          const port = await portRes.json();
          setPortfolio({ currentValue: port.currentValue ?? 0, pnlPct: port.pnlPct ?? 0 });
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const kpis = [
    {
      label: "Patrimonio neto (CLP)",
      value: loading ? "—" : formatCurrency(totalBalance + summary.net, "CLP"),
      delta: summary.net >= 0 ? Math.abs(summary.net / Math.max(totalBalance, 1)) * 100 : -(Math.abs(summary.net / Math.max(totalBalance, 1)) * 100),
      deltaLabel: "flujo del mes",
      icon: <DollarSign size={18} />,
    },
    {
      label: "Ingresos del mes",
      value: loading ? "—" : formatCurrency(summary.income, "CLP"),
      delta: undefined,
      deltaLabel: "este mes",
      icon: <ArrowUpRight size={18} />,
    },
    {
      label: "Gastos del mes",
      value: loading ? "—" : formatCurrency(summary.expenses, "CLP"),
      delta: undefined,
      deltaLabel: "este mes",
      icon: <ArrowDownLeft size={18} />,
    },
    {
      label: "Portfolio",
      value: loading ? "—" : formatCurrency(portfolio?.currentValue ?? 0, "USD"),
      delta: portfolio ? portfolio.pnlPct : undefined,
      deltaLabel: "P&L total",
      icon: <TrendingUp size={18} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Dashboard</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          Resumen financiero — {new Date().toLocaleDateString("es-CL", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            delta={kpi.delta}
            deltaLabel={kpi.deltaLabel}
            icon={kpi.icon}
          />
        ))}
      </div>

      {/* Monthly net banner */}
      {!loading && (
        <div className={`rounded-xl border p-5 ${
          summary.net >= 0
            ? "border-[var(--color-gain-subtle)] bg-[var(--color-gain-subtle)]/20"
            : "border-[var(--color-loss-subtle)] bg-[var(--color-loss-subtle)]/20"
        }`}>
          <p className="text-xs text-[var(--color-text-secondary)]">Balance neto del mes</p>
          <p className={`mt-1 text-3xl font-bold tabular-nums ${summary.net >= 0 ? "text-[var(--color-gain)]" : "text-[var(--color-loss)]"}`}>
            {summary.net >= 0 ? "+" : ""}{formatCurrency(summary.net, "CLP")}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {formatCurrency(summary.income, "CLP")} ingresos · {formatCurrency(summary.expenses, "CLP")} gastos
          </p>
        </div>
      )}

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/transacciones", label: "Ver transacciones", desc: "Historial completo de movimientos" },
          { href: "/email", label: "Emails bancarios", desc: "Revisar transacciones detectadas" },
          { href: "/inversiones", label: "Portfolio", desc: "P&L de ETFs y criptomonedas" },
        ].map((link) => (
          <a key={link.href} href={link.href}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-bg-hover)]">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{link.label}</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{link.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
