"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowUpDown,
  Wallet,
  Tag,
  PieChart,
  Target,
  TrendingUp,
  Mail,
  BarChart2,
  RefreshCw,
  LogOut,
  Send,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "Dashboard" },
  { href: "/transacciones", icon: ArrowUpDown,      label: "Transacciones" },
  { href: "/cuentas",       icon: Wallet,           label: "Cuentas" },
  { href: "/categorias",    icon: Tag,              label: "Categorías" },
  { href: "/presupuesto",   icon: PieChart,         label: "Presupuesto" },
  { href: "/metas",         icon: Target,           label: "Metas" },
  { href: "/inversiones",   icon: TrendingUp,       label: "Inversiones" },
  { href: "/email",         icon: Mail,             label: "Email Banco" },
  { href: "/telegram",      icon: Send,             label: "Bot Telegram" },
  { href: "/reportes",      icon: BarChart2,        label: "Reportes" },
  { href: "/recurrentes",   icon: RefreshCw,        label: "Recurrentes" },
  { href: "/configuracion", icon: Settings,         label: "Configuración" },
];

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/auth/login";
}

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-56 shrink-0 h-screen sticky top-0 bg-[var(--color-bg-surface)] border-r border-[var(--color-border)]">

      {/* ── Logo ── */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--color-border)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1f6feb] to-[#388bfd] text-xs font-extrabold text-white shadow-sm">
          CF
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-[var(--color-text-primary)] tracking-tight">
            Crecimiento
          </span>
          <span className="text-[10px] font-medium text-[var(--color-text-secondary)] tracking-widest uppercase">
            Finanza
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[var(--color-accent)]/12 text-[var(--color-text-primary)] border-l-2 border-[var(--color-accent)] pl-[10px]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <Icon
                size={16}
                className={clsx(
                  "shrink-0 transition-colors",
                  isActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]"
                )}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="border-t border-[var(--color-border)] px-2 py-3 space-y-1">
        {userEmail && (
          <div className="flex items-center gap-2 px-3 py-1.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-elevated)] text-[10px] font-bold text-[var(--color-text-secondary)]">
              {userEmail[0].toUpperCase()}
            </div>
            <p className="text-xs truncate text-[var(--color-text-muted)]">{userEmail}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-loss)]"
        >
          <LogOut size={16} className="shrink-0" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
