"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

interface Account {
  id: string;
  name: string;
  currency: string;
}

interface Category {
  id: string;
  name: string;
}

interface EmailTx {
  id: string;
  rawSubject: string;
  rawSnippet: string;
  parsedAmount: string | null;
  parsedType: string | null;
  parsedDesc: string | null;
  parsedCurrency: string | null;
  receivedAt: string;
}

interface Props {
  tx: EmailTx;
  accounts: Account[];
  categories: Category[];
  onConfirmed: (id: string) => void;
  onRejected: (id: string) => void;
}

export function EmailPreviewCard({ tx, accounts, categories, onConfirmed, onRejected }: Props) {
  const [amount, setAmount] = useState(tx.parsedAmount ?? "");
  const [type, setType] = useState<"EXPENSE" | "INCOME">((tx.parsedType as "EXPENSE" | "INCOME") ?? "EXPENSE");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [currency, setCurrency] = useState(tx.parsedCurrency ?? "CLP");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const receivedDate = new Date(tx.receivedAt).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  async function confirm() {
    if (!accountId || !amount) { setError("Selecciona cuenta y monto"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailTransactionId: tx.id,
          accountId,
          categoryId: categoryId || null,
          amount: parseFloat(amount),
          type,
          currency,
        }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); return; }
      onConfirmed(tx.id);
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    setLoading(true);
    try {
      await fetch("/api/email/confirm", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tx.id }),
      });
      onRejected(tx.id);
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{tx.rawSubject}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{receivedDate}</p>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
            type === "INCOME"
              ? "bg-[var(--color-gain-subtle)] text-[var(--color-gain)]"
              : "bg-[var(--color-loss-subtle)] text-[var(--color-loss)]"
          }`}
        >
          {type === "INCOME" ? "Ingreso" : "Gasto"}
        </span>
      </div>

      {/* Snippet */}
      <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{tx.rawSnippet}</p>

      {/* Editable fields */}
      <div className="grid grid-cols-2 gap-2">
        {/* Type toggle */}
        <div>
          <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "EXPENSE" | "INCOME")}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          >
            <option value="EXPENSE">Gasto</option>
            <option value="INCOME">Ingreso</option>
          </select>
        </div>

        {/* Currency */}
        <div>
          <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Moneda</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          >
            <option value="CLP">CLP</option>
            <option value="USD">USD</option>
            <option value="USDT">USDT</option>
          </select>
        </div>

        {/* Amount */}
        <div>
          <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Monto</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            placeholder="0"
          />
        </div>

        {/* Account */}
        <div>
          <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Cuenta</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Categoría (opcional)</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-[var(--color-loss)]">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={confirm}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-gain)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          Confirmar
        </button>
        <button
          onClick={reject}
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-loss)] hover:text-[var(--color-loss)] disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Descartar
        </button>
      </div>
    </div>
  );
}
