import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrecimientoFinanza",
  description: "Portal financiero personal — inversiones, gastos y control total",
  themeColor: "#0d1117",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
