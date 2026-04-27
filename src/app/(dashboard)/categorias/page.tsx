"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";

interface Category { id: string; name: string; type: string; color: string; icon: string; }

const TYPE_LABELS: Record<string, string> = { EXPENSE: "Gasto", INCOME: "Ingreso" };

interface FormState { name: string; type: string; color: string; }
const defaultForm = (): FormState => ({ name: "", type: "EXPENSE", color: "#8b949e" });

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchCategories() {
    try {
      const res = await fetch("/api/categorias");
      if (res.ok) setCategories(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCategories(); }, []);

  function openCreate() {
    setEditId(null);
    setForm(defaultForm());
    setError("");
    setShowForm(true);
  }

  function openEdit(cat: Category) {
    setEditId(cat.id);
    setForm({ name: cat.name, type: cat.type, color: cat.color });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { setError("El nombre es requerido"); return; }
    setSaving(true);
    setError("");
    try {
      const url = editId ? `/api/categorias/${editId}` : "/api/categorias";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Error"); return; }
      setShowForm(false);
      await fetchCategories();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/categorias/${id}`, { method: "DELETE" });
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Categorías</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">Organiza tus transacciones</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          <Plus className="h-4 w-4" />
          Nueva
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {editId ? "Editar categoría" : "Nueva categoría"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Nombre *</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Alimentación"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Tipo</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]">
                <option value="EXPENSE">Gasto</option>
                <option value="INCOME">Ingreso</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 text-xs text-[var(--color-text-secondary)]">Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-12 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] cursor-pointer" />
                <span className="text-xs text-[var(--color-text-secondary)]">{form.color}</span>
              </div>
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
      ) : categories.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] gap-2">
          <Tag className="h-8 w-8 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">Sin categorías. Crea una para organizar tus gastos.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{cat.name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{TYPE_LABELS[cat.type]}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(cat)}
                  className="rounded p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(cat.id)}
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
