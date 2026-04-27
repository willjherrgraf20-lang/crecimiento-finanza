import { Mail, ShieldCheck, Eye, Lock } from "lucide-react";
import Link from "next/link";

export default function ConectarGmailPage() {
  return (
    <div className="mx-auto max-w-lg py-16 px-4">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent)]/15">
            <Mail className="h-8 w-8 text-[var(--color-accent)]" />
          </div>
        </div>

        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Conecta tu Gmail</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Detectamos automáticamente tus transacciones bancarias desde correos de Banco de Chile,
            Falabella, Santander, Ripley, Tenpo, BancoEstado, Binance, BTG y BCI.
          </p>
        </div>

        <div className="space-y-3 text-left">
          {[
            { icon: Eye, label: "Solo lectura", desc: "Nunca enviamos ni modificamos emails." },
            { icon: ShieldCheck, label: "Tokens encriptados", desc: "Credenciales almacenadas con AES-256-GCM." },
            { icon: Lock, label: "Acceso revocable", desc: "Puedes desconectar en cualquier momento desde Google." },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-elevated)]">
                <Icon className="h-4 w-4 text-[var(--color-text-secondary)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <a
          href="/api/email/auth"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Mail className="h-4 w-4" />
          Conectar Gmail
        </a>

        <Link
          href="/email"
          className="block text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Volver sin conectar
        </Link>
      </div>
    </div>
  );
}
