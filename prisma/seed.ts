import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const SYSTEM_CATEGORIES = [
  { name: "Alimentación", type: "EXPENSE" as const, color: "#f97316", icon: "shopping-cart" },
  { name: "Transporte", type: "EXPENSE" as const, color: "#3b82f6", icon: "car" },
  { name: "Vivienda", type: "EXPENSE" as const, color: "#8b5cf6", icon: "home" },
  { name: "Salud", type: "EXPENSE" as const, color: "#ec4899", icon: "heart" },
  { name: "Entretenimiento", type: "EXPENSE" as const, color: "#f59e0b", icon: "tv" },
  { name: "Ropa", type: "EXPENSE" as const, color: "#06b6d4", icon: "shirt" },
  { name: "Educación", type: "EXPENSE" as const, color: "#10b981", icon: "book" },
  { name: "Tecnología", type: "EXPENSE" as const, color: "#6366f1", icon: "laptop" },
  { name: "Servicios", type: "EXPENSE" as const, color: "#64748b", icon: "zap" },
  { name: "Restaurantes", type: "EXPENSE" as const, color: "#ef4444", icon: "utensils" },
  { name: "Supermercado", type: "EXPENSE" as const, color: "#22c55e", icon: "shopping-bag" },
  { name: "Sueldo", type: "INCOME" as const, color: "#3fb950", icon: "banknote" },
  { name: "Freelance", type: "INCOME" as const, color: "#34d399", icon: "briefcase" },
  { name: "Inversiones", type: "INCOME" as const, color: "#fbbf24", icon: "trending-up" },
  { name: "Otros ingresos", type: "INCOME" as const, color: "#a3e635", icon: "plus-circle" },
  { name: "Otros gastos", type: "EXPENSE" as const, color: "#94a3b8", icon: "more-horizontal" },
];

async function main() {
  console.log("Seeding system categories...");
  for (const cat of SYSTEM_CATEGORIES) {
    await db.category.upsert({
      where: {
        // Using a unique combo — system categories have no userId
        // We use a raw query approach via findFirst + create
        id: `00000000-0000-0000-0000-${cat.name.toLowerCase().replace(/[^a-z]/g, "").padEnd(12, "0").slice(0, 12)}`,
      },
      create: {
        id: `00000000-0000-0000-0000-${cat.name.toLowerCase().replace(/[^a-z]/g, "").padEnd(12, "0").slice(0, 12)}`,
        name: cat.name,
        type: cat.type,
        color: cat.color,
        icon: cat.icon,
        isSystem: true,
        userId: null,
      },
      update: {
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
      },
    });
  }
  console.log(`Seeded ${SYSTEM_CATEGORIES.length} system categories.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
