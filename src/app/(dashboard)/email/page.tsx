"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Inbox } from "lucide-react";
import { ConnectGmailBanner } from "@/components/email/ConnectGmailBanner";
import { EmailPreviewCard } from "@/components/email/EmailPreviewCard";

interface Account { id: string; name: string; currency: string; }
interface Category { id: string; name: string; }
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

export default function EmailPage() {
  const [gmailConnected, setGmailConnected] = useState<boolean | null>(null);
  const [emails, setEmails] = useState<EmailTx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ scanned: number; newPending: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [emailsRes, accountsRes, categoriesRes] = await Promise.all([
        fetch("/api/email/scan"),
        fetch("/api/cuentas"),
        fetch("/api/categorias"),
      ]);

      if (emailsRes.status === 400) {
        // Gmail no conectado
        setGmailConnected(false);
        setLoading(false);
        return;
      }

      const emailsData = await emailsRes.json();
      setEmails(Array.isArray(emailsData) ? emailsData : []);
      setGmailConnected(true);

      if (accountsRes.ok) setAccounts(await accountsRes.json());
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check if redirected from OAuth success
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      window.history.replaceState({}, "", "/email");
    }
    fetchData();
  }, [fetchData]);

  async function scanEmails() {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch("/api/email/scan", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setScanResult({ scanned: data.scanned, newPending: data.newPending });
        await fetchData();
      }
    } finally {
      setScanning(false);
    }
  }

  const handleConfirmed = (id: string) => setEmails((prev) => prev.filter((e) => e.id !== id));
  const handleRejected = (id: string) => setEmails((prev) => prev.filter((e) => e.id !== id));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Email Bancario</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            Transacciones detectadas en tus correos
          </p>
        </div>
        {gmailConnected && (
          <button
            onClick={scanEmails}
            disabled={scanning}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Escaneando…" : "Escanear emails"}
          </button>
        )}
      </div>

      {/* Scan result toast */}
      {scanResult && (
        <div className="rounded-lg border border-[var(--color-gain-subtle)] bg-[var(--color-gain-subtle)]/40 px-4 py-3 text-sm text-[var(--color-gain)]">
          Escaneados: {scanResult.scanned} | Nuevos pendientes: {scanResult.newPending}
        </div>
      )}

      {/* Not connected */}
      {!gmailConnected && <ConnectGmailBanner />}

      {/* Connected but empty */}
      {gmailConnected && emails.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] py-16 text-center">
          <Inbox className="h-10 w-10 text-[var(--color-text-secondary)]" />
          <p className="mt-3 text-sm font-medium text-[var(--color-text-primary)]">Sin emails pendientes</p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Haz clic en &quot;Escanear emails&quot; para buscar nuevas transacciones.
          </p>
        </div>
      )}

      {/* Email list */}
      {gmailConnected && emails.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-secondary)]">{emails.length} pendiente{emails.length !== 1 ? "s" : ""}</p>
          {emails.map((tx) => (
            <EmailPreviewCard
              key={tx.id}
              tx={tx}
              accounts={accounts}
              categories={categories}
              onConfirmed={handleConfirmed}
              onRejected={handleRejected}
            />
          ))}
        </div>
      )}
    </div>
  );
}
