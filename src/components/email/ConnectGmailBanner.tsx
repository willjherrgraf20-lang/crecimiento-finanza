"use client";

import { Mail } from "lucide-react";
import { useState } from "react";

export function ConnectGmailBanner() {
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    setLoading(true);
    window.location.href = "/api/email/auth";
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/15">
        <Mail className="h-6 w-6 text-[var(--color-accent)]" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Conecta tu Gmail</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
          Detectamos automáticamente transferencias y compras desde los correos de tus bancos.
          Solo lectura — nunca modificamos nada.
        </p>
      </div>
      <button
        onClick={handleConnect}
        disabled={loading}
        className="shrink-0 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Redirigiendo…" : "Conectar Gmail"}
      </button>
    </div>
  );
}
