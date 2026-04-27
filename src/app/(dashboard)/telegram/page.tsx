"use client";

import { useState, useEffect } from "react";
import { Send, Link2, Link2Off, CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";

interface LinkStatus {
  linked: boolean;
  telegramUrl: string;
  token: string;
}

interface TelegramTx {
  id: string;
  parsedAmount: number | null;
  parsedType: string | null;
  parsedDesc: string | null;
  parsedDate: string | null;
  parsedCurrency: string | null;
  status: string;
  createdAt: string;
}

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  const cur = currency ?? "CLP";
  if (cur === "CLP") return `$${amount.toLocaleString("es-CL")} CLP`;
  return `${Number(amount).toFixed(2)} ${cur}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING")
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: "rgba(255,170,0,0.15)", color: "#ffaa00" }}
      >
        <Clock size={11} /> Pendiente
      </span>
    );
  if (status === "CONFIRMED")
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ backgroundColor: "rgba(63,185,80,0.15)", color: "#3fb950" }}
      >
        <CheckCircle size={11} /> Confirmado
      </span>
    );
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: "rgba(248,81,73,0.15)", color: "#f85149" }}
    >
      <XCircle size={11} /> Rechazado
    </span>
  );
}

const STEPS = [
  'Haz clic en "Generar enlace de vinculación"',
  "Copia el enlace y ábrelo en Telegram",
  "El bot confirmará la vinculación",
];

const HOW_IT_WORKS = [
  { icon: "📸", title: "Envía una foto", desc: "Toma una captura de pantalla o foto de tu comprobante de transferencia" },
  { icon: "🤖", title: "IA lo procesa", desc: "Gemini AI extrae el monto, fecha y descripción automáticamente" },
  { icon: "✅", title: "Confirma y guarda", desc: "Elige cuenta y categoría con los botones del bot y el gasto queda registrado" },
];

export default function TelegramPage() {
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
  const [transactions, setTransactions] = useState<TelegramTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [linkRes, txRes] = await Promise.all([
        fetch("/api/telegram/link"),
        fetch("/api/telegram/transactions"),
      ]);
      if (linkRes.ok) setLinkStatus(await linkRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateLink = async () => {
    setLinking(true);
    try {
      const res = await fetch("/api/telegram/link");
      if (res.ok) setLinkStatus(await res.json());
    } finally {
      setLinking(false);
    }
  };

  const unlink = async () => {
    if (!confirm("¿Desvincular tu cuenta de Telegram?")) return;
    await fetch("/api/telegram/link", { method: "DELETE" });
    setLinkStatus(null);
    fetchStatus();
  };

  const copyLink = () => {
    if (!linkStatus?.telegramUrl) return;
    navigator.clipboard.writeText(linkStatus.telegramUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,136,204,0.15)" }}
        >
          <Send size={20} style={{ color: "#0088cc" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            Bot de Telegram
          </h1>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Registra comprobantes de transferencia enviando una foto al bot
          </p>
        </div>
      </div>

      {/* Estado de vinculación */}
      <div
        className="rounded-xl p-6 space-y-4"
        style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Vinculación de cuenta
          </h2>
          {linkStatus?.linked && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: "rgba(63,185,80,0.15)", color: "#3fb950" }}
            >
              <CheckCircle size={12} /> Vinculado
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Cargando...</p>
        ) : linkStatus?.linked ? (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Tu cuenta de Telegram está vinculada correctamente. Puedes enviar fotos de comprobantes al bot.
            </p>
            <button
              onClick={unlink}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
              style={{ backgroundColor: "rgba(248,81,73,0.1)", color: "#f85149", border: "1px solid rgba(248,81,73,0.3)" }}
            >
              <Link2Off size={15} />
              Desvincular Telegram
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Vincula tu cuenta para empezar a registrar comprobantes desde Telegram.
            </p>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>
                Pasos
              </p>
              <ol className="space-y-2">
                {STEPS.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                      style={{ backgroundColor: "rgba(0,136,204,0.2)", color: "#0088cc" }}
                    >
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {linkStatus?.telegramUrl ? (
              <div className="space-y-2">
                <div
                  className="flex items-center gap-2 p-3 rounded-lg text-sm break-all"
                  style={{ backgroundColor: "var(--color-bg-base)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
                >
                  {linkStatus.telegramUrl}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyLink}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ backgroundColor: copied ? "rgba(63,185,80,0.15)" : "rgba(0,136,204,0.15)", color: copied ? "#3fb950" : "#0088cc" }}
                  >
                    <Link2 size={15} />
                    {copied ? "¡Copiado!" : "Copiar enlace"}
                  </button>
                  <a
                    href={linkStatus.telegramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: "#0088cc", color: "white" }}
                  >
                    <Send size={15} />
                    Abrir en Telegram
                  </a>
                </div>
              </div>
            ) : (
              <button
                onClick={generateLink}
                disabled={linking}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ backgroundColor: "#0088cc", color: "white", opacity: linking ? 0.7 : 1 }}
              >
                <Link2 size={15} />
                {linking ? "Generando..." : "Generar enlace de vinculación"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cómo usar */}
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
      >
        <h2 className="font-semibold mb-4" style={{ color: "var(--color-text-primary)" }}>
          ¿Cómo funciona?
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <div
              key={item.title}
              className="p-4 rounded-lg space-y-2"
              style={{ backgroundColor: "var(--color-bg-base)" }}
            >
              <div className="text-2xl">{item.icon}</div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{item.title}</p>
              <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Historial */}
      <div
        className="rounded-xl"
        style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
      >
        <div
          className="flex items-center justify-between p-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2 className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Comprobantes procesados
          </h2>
          <button
            onClick={fetchStatus}
            className="p-1.5 rounded-lg transition-colors hover:opacity-70"
            style={{ color: "var(--color-text-muted)" }}
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="p-8 text-center">
            <Send size={32} className="mx-auto mb-3 opacity-30" style={{ color: "var(--color-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Aún no has enviado ningún comprobante
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {tx.parsedDesc ?? "Sin descripción"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {tx.parsedDate ? new Date(tx.parsedDate).toLocaleDateString("es-CL") : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={tx.status} />
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: tx.parsedType === "INCOME" ? "#3fb950" : "#f85149" }}
                  >
                    {formatAmount(tx.parsedAmount, tx.parsedCurrency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
