"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al iniciar sesión");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--color-bg-base)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold"
            style={{ backgroundColor: "var(--color-accent)", color: "white" }}
          >
            CF
          </div>
          <span className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
            CrecimientoFinanza
          </span>
        </div>

        <div className="cf-card p-6">
          <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
            Iniciar sesión
          </h1>
          <p className="text-sm mb-6" style={{ color: "var(--color-text-secondary)" }}>
            Accede a tu portal financiero
          </p>

          {error && (
            <div
              className="rounded-md px-4 py-3 mb-4 text-sm"
              style={{ backgroundColor: "var(--color-loss-subtle)", color: "var(--color-loss)" }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md text-sm transition-colors"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
                placeholder="tu@email.com"
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md text-sm"
                style={{
                  backgroundColor: "var(--color-bg-elevated)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                  outline: "none",
                }}
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md text-sm font-medium transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--color-accent)", color: "white" }}
            >
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: "var(--color-text-secondary)" }}>
          ¿No tienes cuenta?{" "}
          <Link href="/auth/register" className="font-medium" style={{ color: "var(--color-accent)" }}>
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
