"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

interface Holding {
  id: string;
  quantity: number;
  avgCostBasis: string;
  currency: string;
  asset: {
    id: string;
    ticker: string;
    name: string;
    assetType: string;
    currentPrice: string | null;
    currency: string;
  };
}

interface FormState { ticker: string; name: string; quantity: string; avgCostBasis: string; currency: string; }
const defaultForm = (): FormState => ({ ticker: "", name: "", quantity: "", avgCostBasis: "", currency: "USD" });

export default function EtfPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchHoldings() {
    try {
      const res = await fetch("/api/inversiones/holdings?type=ETF");
      if (res.ok) setHoldings(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchHoldings(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ticker || !form.quantity || !form.avgCostBasis) { setError("Ticker, cantidad y precio promedio son requeridos"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/inversiones/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: form.ticker.toUpperCase(),
          name: form.name || form.ticker.toUpperCase(),
          assetType: "ETF",
          quantity: parseFloat(form.quantity),
          avgCostBasis: parseFloat(form.avgCostBasis),
          currency: form.currency,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); return; }
      setForm(defaultForm());
      setShowForm(false);
      await fetchHoldings();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/inversiones/holdings/${id}`, { method: "DELETE" });
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">ETF & Acciones</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Posiciones en fondos indexados</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError(""); }}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Plus className="h-4 w-4" />
          Agregar
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Nuevo ETF / Acción</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Ticker *</label>
              <input type="text" value={form.ticker} onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
                placeholder="SPY"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Nombre</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="SPDR S&P 500"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Cantidad *</label>
              <input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="10"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Precio promedio *</label>
              <input type="number" value={form.avgCostBasis} onChange={(e) => setForm((f) => ({ ...f, avgCostBasis: e.target.value }))}
                placeholder="450.00"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Moneda</label>
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option value="USD">USD</option>
                <option value="CLP">CLP</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-[var(--color-loss)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : holdings.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
          <p className="text-sm text-[var(--color-text-secondary)]">Sin ETFs. Agrega tu primer holding.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Ticker</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Cantidad</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Costo avg.</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Precio actual</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">P&L</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const avg = parseFloat(h.avgCostBasis);
                const price = h.asset.currentPrice ? parseFloat(h.asset.currentPrice) : null;
                const pnl = price ? (price - avg) * h.quantity : null;
                const pnlPct = price && avg > 0 ? ((price - avg) / avg) * 100 : null;
                const isGain = (pnl ?? 0) >= 0;
                return (
                  <tr key={h.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--color-text-primary)]">{h.asset.ticker}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{h.asset.name}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">{h.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                      {formatCurrency(avg, h.currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                      {price ? formatCurrency(price, h.asset.currency) : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${isGain ? "text-[var(--color-gain)]" : "text-[var(--color-loss)]"}`}>
                      {pnl !== null ? (
                        <div className="flex items-center justify-end gap-1">
                          {isGain ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {isGain ? "+" : ""}{formatCurrency(pnl, h.currency)}
                          {pnlPct !== null && <span className="text-xs">({isGain ? "+" : ""}{pnlPct.toFixed(2)}%)</span>}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-2 py-3">
                      <button onClick={() => handleDelete(h.id)}
                        className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-loss)] transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
