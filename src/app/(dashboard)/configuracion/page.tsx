"use client";

import { useEffect, useState } from "react";
import { Mail, Lock, Check, AlertCircle, Unlink, RefreshCw } from "lucide-react";

interface GmailStatus {
  connected: boolean;
  emailAddress?: string | null;
  connectedAt?: string;
}

export default function ConfiguracionPage() {
  /* ── Cambio de contraseña ── */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  /* ── Gmail ── */
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  async function fetchGmailStatus() {
    setGmailLoading(true);
    try {
      const res = await fetch("/api/email/status");
      if (res.ok) {
        const data = await res.json();
        setGmailStatus(data);
      } else {
        setGmailStatus({ connected: false });
      }
    } catch {
      setGmailStatus({ connected: false });
    } finally {
      setGmailLoading(false);
    }
  }

  useEffect(() => {
    fetchGmailStatus();
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwError("Las contraseñas nuevas no coinciden");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }

    setPwSubmitting(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPwError(data.error ?? `Error ${res.status}`);
      }
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setPwSubmitting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("¿Seguro que quieres desvincular tu cuenta de Gmail? Tendrás que volver a conectarla para escanear correos.")) {
      return;
    }
    setDisconnecting(true);
    try {
      const res = await fetch("/api/email/disconnect", { method: "POST" });
      if (res.ok) {
        await fetchGmailStatus();
      }
    } finally {
      setDisconnecting(false);
    }
  }

  function handleConnect() {
    window.location.href = "/api/email/auth";
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Configuración</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
          Gestiona tu cuenta y conexiones
        </p>
      </div>

      {/* ─── Cambiar contraseña ─── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)]">
            <Lock className="h-5 w-5 text-[var(--color-accent)]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Cambiar contraseña</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Mínimo 8 caracteres</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label htmlFor="cf-current-pw" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Contraseña actual
            </label>
            <input
              id="cf-current-pw"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="cf-new-pw" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Nueva contraseña
            </label>
            <input
              id="cf-new-pw"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="cf-confirm-pw" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Confirmar nueva contraseña
            </label>
            <input
              id="cf-confirm-pw"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>

          {pwError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{pwError}</span>
            </div>
          )}
          {pwSuccess && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--color-gain-subtle)] bg-[var(--color-gain-subtle)]/40 px-3 py-2 text-sm text-[var(--color-gain)]">
              <Check className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Contraseña actualizada correctamente.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={pwSubmitting}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-50"
          >
            {pwSubmitting ? "Guardando…" : "Cambiar contraseña"}
          </button>
        </form>
      </section>

      {/* ─── Gmail conectado ─── */}
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)]">
            <Mail className="h-5 w-5 text-[var(--color-accent)]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Cuenta de Gmail</h2>
            <p className="text-xs text-[var(--color-text-secondary)]">Para escanear correos bancarios</p>
          </div>
        </div>

        {gmailLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Cargando estado…
          </div>
        ) : gmailStatus?.connected ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] mb-1">
                <Check className="h-3.5 w-3.5 text-[var(--color-gain)]" />
                Cuenta conectada
              </div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                {gmailStatus.emailAddress ?? "Email no disponible"}
              </div>
              {gmailStatus.connectedAt && (
                <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Conectada el {new Date(gmailStatus.connectedAt).toLocaleDateString("es-CL")}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
              >
                <Unlink className="h-4 w-4" />
                {disconnecting ? "Desvinculando…" : "Desvincular"}
              </button>
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)]"
              >
                <RefreshCw className="h-4 w-4" />
                Conectar otra cuenta
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Al conectar otra cuenta, la actual se desvincula automáticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              No tienes ninguna cuenta de Gmail conectada.
            </p>
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110"
            >
              <Mail className="h-4 w-4" />
              Conectar Gmail
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
