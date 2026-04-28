"use client";

import { useState } from "react";
import { Shield, Eye, Zap, Mail } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Detección automática",
    desc: "Banco de Chile, Falabella, Santander, Ripley, Tenpo, BancoEstado, Binance, BTG, BCI",
  },
  {
    icon: Eye,
    title: "Solo lectura",
    desc: "Nunca enviamos, modificamos ni eliminamos ningún correo tuyo.",
  },
  {
    icon: Shield,
    title: "Tokens encriptados",
    desc: "Credenciales guardadas con AES-256-GCM. Revocable en cualquier momento.",
  },
];

export function ConnectGmailBanner() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Card principal */}
      <div className="w-full max-w-md">
        {/* Hero icon area */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1f6feb]/30 to-[#388bfd]/10 border border-[#1f6feb]/30">
              <Mail className="h-9 w-9 text-[#388bfd]" />
            </div>
            {/* Glow */}
            <div className="absolute inset-0 rounded-2xl bg-[#1f6feb]/10 blur-xl" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            Conecta tu correo bancario
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)] max-w-sm">
            Detectamos tus transferencias y pagos directamente desde los correos de notificación de tus bancos. Sin ingresar datos manualmente.
          </p>
        </div>

        {/* Features */}
        <div className="mb-8 space-y-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)]">
                <Icon className="h-4 w-4 text-[#388bfd]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Google sign-in button */}
        <button
          onClick={() => { setLoading(true); window.location.href = "/api/email/auth"; }}
          disabled={loading}
          className="group flex w-full items-center justify-center gap-3 rounded-xl border border-[var(--color-border)] bg-white px-5 py-3 text-sm font-semibold text-gray-800 shadow-sm transition-all hover:shadow-md hover:brightness-95 disabled:opacity-60"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-gray-800" />
          ) : (
            /* Google logo */
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          {loading ? "Redirigiendo a Google…" : "Continuar con Google"}
        </button>

        <p className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
          Puedes revocar el acceso en cualquier momento desde{" "}
          <span className="text-[var(--color-text-secondary)]">myaccount.google.com</span>
        </p>
      </div>
    </div>
  );
}
