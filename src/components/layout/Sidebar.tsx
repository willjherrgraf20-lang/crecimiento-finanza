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
} from "lucide-react";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/transacciones", icon: ArrowUpDown, label: "Transacciones" },
  { href: "/cuentas", icon: Wallet, label: "Cuentas" },
  { href: "/categorias", icon: Tag, label: "Categorías" },
  { href: "/presupuesto", icon: PieChart, label: "Presupuesto" },
  { href: "/metas", icon: Target, label: "Metas" },
  { href: "/inversiones", icon: TrendingUp, label: "Inversiones" },
  { href: "/email", icon: Mail, label: "Email Banco" },
  { href: "/reportes", icon: BarChart2, label: "Reportes" },
  { href: "/recurrentes", icon: RefreshCw, label: "Recurrentes" },
];

async function handleLogout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/auth/login";
}

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col w-56 shrink-0 h-screen sticky top-0"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2 px-4 py-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
          style={{ backgroundColor: "var(--color-accent)", color: "white" }}
        >
          CF
        </div>
        <span className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>
          CrecimientoFinanza
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "border-l-2"
                  : "hover:bg-[--color-bg-hover]"
              )}
              style={{
                color: isActive ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                backgroundColor: isActive ? "var(--color-bg-hover)" : undefined,
                borderLeftColor: isActive ? "var(--color-accent)" : undefined,
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-3 py-3 space-y-1"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        {userEmail && (
          <p className="px-3 py-1 text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
            {userEmail}
          </p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm transition-colors hover:bg-[--color-bg-hover]"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <LogOut size={16} />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
