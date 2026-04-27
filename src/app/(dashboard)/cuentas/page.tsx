"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

interface Account {
  id: string;
  name: string;
  type: string;
  currency: string;
  initialBalance: string;
  balance?: number;
}

const ACCOUNT_TYPES = ["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH", "BROKER", "WALLET"] as const;
const TYPE_LABELS: Record<string, string> = {
  CHECKING: "Cuenta corriente",
  SAVINGS: "Ahorro",
  CREDIT_CARD: "Tarjeta crédito",
  CASH: "Efectivo",
  BROKER: "Corredor / Inversiones",
  WALLET: "Billetera cripto",
};

interface FormState { name: string; type: string; currency: string; initialBalance: string; }
const defaultForm = (): FormState => ({ name: "", type: "CHECKING", currency: "CLP", initialBalance: "0" });

export default function CuentasPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/cuentas");
      if (res.ok) setAccounts(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAccounts(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(defaultForm());
    setError("");
    setShowForm(true);
  }

  function openEdit(acc: Account) {
    setEditId(acc.id);
    setForm({ name: acc.name, type: acc.type, currency: acc.currency, initialBalance: acc.initialBalance });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { setError("El nombre es requerido"); return; }
    setSaving(true);
    setError("");
    try {
      const url = editId ? `/api/cuentas/${editId}` : "/api/cuentas";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, initialBalance: parseFloat(form.initialBalance) }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); return; }
      setShowForm(false);
      await fetchAccounts();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/cuentas/${id}`, { method: "DELETE" });
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }

  const totalCLP = accounts.filter((a) => a.currency === "CLP").reduce((s, a) => s + parseFloat(a.initialBalance), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Cuentas</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Administra tus cuentas bancarias</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Plus className="h-4 w-4" />
          Nueva cuenta
        </button>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
        <p className="text-xs text-[var(--color-text-secondary)]">Total CLP</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">
          {formatCurrency(totalCLP, "CLP")}
        </p>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {editId ? "Editar cuenta" : "Nueva cuenta"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Nombre *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Banco de Chile"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Tipo</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
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
            <div className="col-span-2">
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Saldo inicial</label>
              <input type="number" value={form.initialBalance} onChange={(e) => setForm((f) => ({ ...f, initialBalance: e.target.value }))}
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

      {/* List */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] gap-2">
          <Wallet className="h-8 w-8 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">Sin cuentas. Crea una para empezar.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-[var(--color-text-primary)]">{acc.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{TYPE_LABELS[acc.type] ?? acc.type}</p>
                </div>
                <span className="rounded px-1.5 py-0.5 text-xs border border-[var(--color-border)] text-[var(--color-text-secondary)]">
                  {acc.currency}
                </span>
              </div>
              <p className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">
                {formatCurrency(parseFloat(acc.initialBalance), acc.currency)}
              </p>
              <div className="flex justify-end gap-1">
                <button onClick={() => openEdit(acc)}
                  className="rounded p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(acc.id)}
                  className="rounded p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-loss)] transition-colors">
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
