"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import Link from "next/link";

interface Position {
  assetId: string;
  ticker: string;
  name: string;
  assetType: string;
  quantity: number;
  avgCost: number;
  currentPrice: number | null;
  totalCost: number;
  currentValue: number | null;
  unrealizedPnL: number | null;
  pnlPct: number | null;
  currency: string;
}

interface PortfolioSnapshot {
  totalCost: number;
  currentValue: number;
  unrealizedPnL: number;
  pnlPct: number;
  positions: Position[];
}

export default function InversionesPage() {
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function fetchPortfolio() {
    try {
      const res = await fetch("/api/inversiones/portafolio");
      if (res.ok) setPortfolio(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchPortfolio(); }, []);

  async function syncPrices() {
    setSyncing(true);
    try {
      await fetch("/api/sync-prices", { method: "POST" });
      await fetchPortfolio();
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  const pnlPositive = (portfolio?.unrealizedPnL ?? 0) >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Inversiones</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Portfolio overview</p>
        </div>
        <div className="flex gap-2">
          <Link href="/inversiones/etf"
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
            ETF
          </Link>
          <Link href="/inversiones/cripto"
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
            Cripto
          </Link>
          <button onClick={syncPrices} disabled={syncing}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Valor actual</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">
            {formatCurrency(portfolio?.currentValue ?? 0, "USD")}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
          <p className="text-xs text-[var(--color-text-secondary)]">Costo total</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">
            {formatCurrency(portfolio?.totalCost ?? 0, "USD")}
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${
          pnlPositive
            ? "border-[var(--color-gain-subtle)] bg-[var(--color-gain-subtle)]/30"
            : "border-[var(--color-loss-subtle)] bg-[var(--color-loss-subtle)]/30"
        }`}>
          <p className="text-xs text-[var(--color-text-secondary)]">P&L no realizado</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${pnlPositive ? "text-[var(--color-gain)]" : "text-[var(--color-loss)]"}`}>
            {pnlPositive ? "+" : ""}{formatCurrency(portfolio?.unrealizedPnL ?? 0, "USD")}
          </p>
          {portfolio && portfolio.pnlPct !== 0 && (
            <div className={`mt-1 flex items-center gap-1 text-xs font-semibold ${pnlPositive ? "text-[var(--color-gain)]" : "text-[var(--color-loss)]"}`}>
              {pnlPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {pnlPositive ? "+" : ""}{portfolio.pnlPct.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* Positions table */}
      {(!portfolio || portfolio.positions.length === 0) ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] gap-2">
          <TrendingUp className="h-8 w-8 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">Sin posiciones. Agrega holdings en ETF o Cripto.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Activo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Cantidad</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Precio</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Valor</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">P&L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.positions.map((p) => {
                const isGain = (p.unrealizedPnL ?? 0) >= 0;
                return (
                  <tr key={p.assetId} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--color-text-primary)]">{p.ticker}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{p.name}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                      {p.quantity}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                      {p.currentPrice ? formatCurrency(p.currentPrice, p.currency) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                      {p.currentValue ? formatCurrency(p.currentValue, p.currency) : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${isGain ? "text-[var(--color-gain)]" : "text-[var(--color-loss)]"}`}>
                      {p.unrealizedPnL !== null ? (
                        <>
                          {isGain ? "+" : ""}{formatCurrency(p.unrealizedPnL, p.currency)}
                          {p.pnlPct !== null && (
                            <span className="ml-1 text-xs">({isGain ? "+" : ""}{p.pnlPct.toFixed(2)}%)</span>
                          )}
                        </>
                      ) : "—"}
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
