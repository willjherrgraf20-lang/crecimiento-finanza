"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Target } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

interface Category { id: string; name: string; }
interface Budget {
  id: string;
  name: string;
  amountLimit: string;
  currency: string;
  periodType: string;
  periodYear: number;
  periodMonth: number | null;
  category: Category | null;
}

interface FormState {
  name: string;
  categoryId: string;
  amountLimit: string;
  currency: string;
  periodType: string;
  periodYear: string;
  periodMonth: string;
}

const defaultForm = (): FormState => ({
  name: "",
  categoryId: "",
  amountLimit: "",
  currency: "CLP",
  periodType: "MONTHLY",
  periodYear: new Date().getFullYear().toString(),
  periodMonth: (new Date().getMonth() + 1).toString(),
});

export default function PresupuestoPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchData() {
    try {
      const [bRes, cRes] = await Promise.all([fetch("/api/presupuesto"), fetch("/api/categorias")]);
      if (bRes.ok) setBudgets(await bRes.json());
      if (cRes.ok) setCategories(await cRes.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(defaultForm());
    setError("");
    setShowForm(true);
  }

  function openEdit(b: Budget) {
    setEditId(b.id);
    setForm({
      name: b.name,
      categoryId: b.category?.id ?? "",
      amountLimit: b.amountLimit,
      currency: b.currency,
      periodType: b.periodType,
      periodYear: b.periodYear.toString(),
      periodMonth: b.periodMonth?.toString() ?? "",
    });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.amountLimit) { setError("Nombre y monto límite son requeridos"); return; }
    setSaving(true);
    setError("");
    try {
      const url = editId ? `/api/presupuesto/${editId}` : "/api/presupuesto";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          categoryId: form.categoryId || null,
          amountLimit: parseFloat(form.amountLimit),
          currency: form.currency,
          periodType: form.periodType,
          periodYear: parseInt(form.periodYear),
          periodMonth: form.periodMonth ? parseInt(form.periodMonth) : null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(Array.isArray(d.error) ? d.error.map((e: { message: string }) => e.message).join(", ") : (d.error ?? "Error")); return; }
      setShowForm(false);
      await fetchData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/presupuesto/${id}`, { method: "DELETE" });
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Presupuesto</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Límites de gasto por categoría</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Plus className="h-4 w-4" />
          Nuevo
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {editId ? "Editar presupuesto" : "Nuevo presupuesto"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Nombre *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Alimentación Mensual"
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
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Período</label>
              <select value={form.periodType} onChange={(e) => setForm((f) => ({ ...f, periodType: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option value="MONTHLY">Mensual</option>
                <option value="YEARLY">Anual</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Monto límite *</label>
              <input type="number" value={form.amountLimit} onChange={(e) => setForm((f) => ({ ...f, amountLimit: e.target.value }))}
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
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Año</label>
              <input type="number" value={form.periodYear} onChange={(e) => setForm((f) => ({ ...f, periodYear: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            {form.periodType === "MONTHLY" && (
              <div>
                <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Mes</label>
                <select value={form.periodMonth} onChange={(e) => setForm((f) => ({ ...f, periodMonth: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                  {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
            )}
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
      ) : budgets.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] gap-2">
          <Target className="h-8 w-8 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">Sin presupuestos. Define límites para tus categorías.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => (
            <div key={b.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{b.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {b.category?.name ?? "Sin categoría"} · {b.periodType === "MONTHLY" ? "Mensual" : "Anual"} {b.periodYear}
                    {b.periodMonth && ` · ${MONTHS[b.periodMonth - 1]}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
                    {formatCurrency(parseFloat(b.amountLimit), b.currency)}
                  </span>
                  <button onClick={() => openEdit(b)}
                    className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDelete(b.id)}
                    className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-loss)] transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
