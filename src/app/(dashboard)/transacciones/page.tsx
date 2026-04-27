"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateShort } from "@/lib/utils/date";

interface Account { id: string; name: string; currency: string; }
interface Category { id: string; name: string; }
interface Expense {
  id: string;
  amount: string;
  type: "EXPENSE" | "INCOME";
  description: string | null;
  date: string;
  currency: string;
  account: Account;
  category: Category | null;
}

interface FormState {
  accountId: string;
  categoryId: string;
  amount: string;
  type: "EXPENSE" | "INCOME";
  description: string;
  currency: string;
  date: string;
}

const defaultForm = (): FormState => ({
  accountId: "",
  categoryId: "",
  amount: "",
  type: "EXPENSE",
  description: "",
  currency: "CLP",
  date: new Date().toISOString().split("T")[0],
});

export default function TransaccionesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "EXPENSE" | "INCOME">("ALL");

  const fetchAll = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (typeFilter !== "ALL") params.set("type", typeFilter);

      const [expRes, accRes, catRes] = await Promise.all([
        fetch(`/api/transacciones?${params}`),
        fetch("/api/cuentas"),
        fetch("/api/categorias"),
      ]);
      if (expRes.ok) { const d = await expRes.json(); setExpenses(d.items ?? d); }
      if (accRes.ok) {
        const accs = await accRes.json();
        setAccounts(accs);
        if (!form.accountId && accs.length > 0) setForm((f) => ({ ...f, accountId: accs[0].id }));
      }
      if (catRes.ok) setCategories(await catRes.json());
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, form.accountId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.accountId || !form.amount) { setError("Completa los campos requeridos"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/transacciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: form.accountId,
          categoryId: form.categoryId || null,
          amount: parseFloat(form.amount),
          type: form.type,
          description: form.description || null,
          currency: form.currency,
          date: new Date(form.date).toISOString(),
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); return; }
      setForm(defaultForm());
      setShowForm(false);
      await fetchAll();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/transacciones/${id}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Transacciones</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Historial de gastos e ingresos</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Nueva
        </button>
      </div>

      {/* New transaction form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Nueva transacción</h2>
          <div className="grid grid-cols-2 gap-3">
            {/* Type */}
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Tipo *</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "EXPENSE" | "INCOME" }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option value="EXPENSE">Gasto</option>
                <option value="INCOME">Ingreso</option>
              </select>
            </div>
            {/* Currency */}
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Moneda</label>
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
            {/* Amount */}
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Monto *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            {/* Date */}
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Fecha</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            {/* Account */}
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Cuenta *</label>
              <select value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option value="">Seleccionar cuenta</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {/* Category */}
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Categoría</label>
              <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          {/* Description */}
          <div>
            <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Descripción</label>
            <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descripción opcional"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
          </div>
          {error && <p className="text-xs text-[var(--color-loss)]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setError(""); }}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar transacciones…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] pl-9 pr-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-1">
          {(["ALL", "EXPENSE", "INCOME"] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}>
              {t === "ALL" ? "Todos" : t === "EXPENSE" ? "Gastos" : "Ingresos"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
          <p className="text-sm text-[var(--color-text-secondary)]">Sin transacciones</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Cuenta</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)]">Fecha</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)]">Monto</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-hover)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {e.type === "INCOME"
                        ? <TrendingUp className="h-4 w-4 text-[var(--color-gain)] shrink-0" />
                        : <TrendingDown className="h-4 w-4 text-[var(--color-loss)] shrink-0" />}
                      <span className="text-[var(--color-text-primary)] truncate max-w-[200px]">
                        {e.description ?? "Sin descripción"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{e.account.name}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{e.category?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{formatDateShort(new Date(e.date))}</td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${
                    e.type === "INCOME" ? "text-[var(--color-gain)]" : "text-[var(--color-loss)]"
                  }`}>
                    {e.type === "INCOME" ? "+" : "−"}{formatCurrency(parseFloat(e.amount), e.currency)}
                  </td>
                  <td className="px-2 py-3">
                    <button onClick={() => handleDelete(e.id)}
                      className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-loss)] transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
