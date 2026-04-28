"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateShort } from "@/lib/utils/date";

interface Account { id: string; name: string; }
interface Category { id: string; name: string; }
interface Recurring {
  id: string;
  name: string;
  amount: string;
  currency: string;
  type: string;
  frequency: string;
  nextDueDate: string;
  isActive: boolean;
  category: Category | null;
  account: Account;
}

const FREQ_LABELS: Record<string, string> = {
  DAILY: "Diario", WEEKLY: "Semanal", BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual", YEARLY: "Anual",
};

interface FormState {
  name: string; amount: string; currency: string;
  type: "EXPENSE" | "INCOME"; accountId: string; categoryId: string;
  frequency: string; nextDueDate: string;
}
const defaultForm = (): FormState => ({
  name: "", amount: "", currency: "CLP", type: "EXPENSE",
  accountId: "", categoryId: "", frequency: "MONTHLY",
  nextDueDate: new Date().toISOString().split("T")[0],
});

export default function RecurrentesPage() {
  const [items, setItems] = useState<Recurring[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchData() {
    try {
      const [rRes, aRes, cRes] = await Promise.all([
        fetch("/api/recurrentes"),
        fetch("/api/cuentas"),
        fetch("/api/categorias"),
      ]);
      if (rRes.ok) setItems(await rRes.json());
      if (aRes.ok) {
        const accs = await aRes.json();
        setAccounts(accs);
        if (accs.length > 0) setForm((f) => ({ ...f, accountId: accs[0].id }));
      }
      if (cRes.ok) setCategories(await cRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.amount || !form.accountId) {
      setError("Nombre, monto y cuenta son requeridos");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/recurrentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          amount: parseFloat(form.amount),
          currency: form.currency,
          type: form.type,
          accountId: form.accountId,
          categoryId: form.categoryId || null,
          frequency: form.frequency,
          nextDueDate: new Date(form.nextDueDate).toISOString(),
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(Array.isArray(d.error) ? d.error.map((e: { message: string }) => e.message).join(", ") : (d.error ?? "Error")); return; }
      setShowForm(false);
      setForm(defaultForm());
      await fetchData();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: Recurring) {
    await fetch(`/api/recurrentes/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isActive: !i.isActive } : i));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/recurrentes/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Recurrentes</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Gastos e ingresos periódicos</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError(""); }}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Plus className="h-4 w-4" />
          Nuevo
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Nuevo recurrente</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Nombre *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Netflix"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Tipo</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "EXPENSE" | "INCOME" }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option value="EXPENSE">Gasto</option>
                <option value="INCOME">Ingreso</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Frecuencia</label>
              <select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                {Object.entries(FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Monto *</label>
              <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Moneda</label>
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Cuenta *</label>
              <select value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option value="">Seleccionar</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Próxima fecha</label>
              <input type="date" value={form.nextDueDate} onChange={(e) => setForm((f) => ({ ...f, nextDueDate: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Categoría</label>
              <select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
      ) : items.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] gap-2">
          <RefreshCw className="h-8 w-8 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">Sin recurrentes. Agrega gastos o ingresos periódicos.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className={`flex items-center justify-between rounded-xl border bg-[var(--color-bg-surface)] px-4 py-3 ${
              item.isActive ? "border-[var(--color-border)]" : "border-[var(--color-border)] opacity-50"
            }`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                  item.type === "INCOME" ? "bg-[var(--color-gain)]" : "bg-[var(--color-loss)]"
                }`} />
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-text-primary)] truncate">{item.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {FREQ_LABELS[item.frequency]} · Próximo: {formatDateShort(new Date(item.nextDueDate))}
                    {item.category && ` · ${item.category.name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`font-semibold tabular-nums text-sm ${
                  item.type === "INCOME" ? "text-[var(--color-gain)]" : "text-[var(--color-loss)]"
                }`}>
                  {item.type === "INCOME" ? "+" : "−"}{formatCurrency(parseFloat(item.amount), item.currency)}
                </span>
                <button onClick={() => toggleActive(item)}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                  {item.isActive
                    ? <ToggleRight className="h-5 w-5 text-[var(--color-gain)]" />
                    : <ToggleLeft className="h-5 w-5" />}
                </button>
                <button onClick={() => handleDelete(item.id)}
                  className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-loss)] transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
