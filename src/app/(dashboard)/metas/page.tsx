"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

interface Goal {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  targetDate: string | null;
}

interface FormState {
  name: string;
  targetAmount: string;
  currentAmount: string;
  currency: string;
  targetDate: string;
}

const defaultForm = (): FormState => ({
  name: "",
  targetAmount: "",
  currentAmount: "0",
  currency: "CLP",
  targetDate: "",
});

export default function MetasPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchGoals() {
    try {
      const res = await fetch("/api/metas");
      if (res.ok) setGoals(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchGoals(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(defaultForm());
    setError("");
    setShowForm(true);
  }

  function openEdit(g: Goal) {
    setEditId(g.id);
    setForm({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      currency: g.currency,
      targetDate: g.targetDate ? g.targetDate.split("T")[0] : "",
    });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.targetAmount) { setError("Nombre y monto objetivo son requeridos"); return; }
    setSaving(true);
    setError("");
    try {
      const url = editId ? `/api/metas/${editId}` : "/api/metas";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          targetAmount: parseFloat(form.targetAmount),
          currentAmount: parseFloat(form.currentAmount),
          currency: form.currency,
          targetDate: form.targetDate ? new Date(form.targetDate).toISOString() : null,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); return; }
      setShowForm(false);
      await fetchGoals();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/metas/${id}`, { method: "DELETE" });
    setGoals((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Metas de Ahorro</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Seguimiento de objetivos financieros</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Plus className="h-4 w-4" />
          Nueva meta
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {editId ? "Editar meta" : "Nueva meta"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Nombre *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Viaje a Europa"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Objetivo *</label>
              <input type="number" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                placeholder="0"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Acumulado</label>
              <input type="number" value={form.currentAmount} onChange={(e) => setForm((f) => ({ ...f, currentAmount: e.target.value }))}
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
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Fecha límite</label>
              <input type="date" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
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
      ) : goals.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] gap-2">
          <Trophy className="h-8 w-8 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">Sin metas. Define tu primer objetivo financiero.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const target = parseFloat(g.targetAmount);
            const current = parseFloat(g.currentAmount);
            const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
            const done = pct >= 100;
            return (
              <div key={g.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{g.name}</p>
                    {g.targetDate && (
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Límite: {new Date(g.targetDate).toLocaleDateString("es-CL")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(g)}
                      className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(g.id)}
                      className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-loss)] transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-end justify-between">
                    <span className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">
                      {formatCurrency(current, g.currency)}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      de {formatCurrency(target, g.currency)}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: done ? "var(--color-gain)" : "var(--color-accent)",
                      }}
                    />
                  </div>
                  <p className={`text-xs font-semibold ${done ? "text-[var(--color-gain)]" : "text-[var(--color-text-secondary)]"}`}>
                    {pct.toFixed(1)}% {done ? "— ¡Meta alcanzada!" : "completado"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
