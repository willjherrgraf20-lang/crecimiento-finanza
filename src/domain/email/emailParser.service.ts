import type { ParsedEmailTx } from "./email.types";

function normalize(str: string): string {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Patrones para bancos chilenos
const INCOME_PATTERNS = [
  /(?:te abonamos?|recibiste|ingres[ao]|dep[oó]sito|transferencia recibida|abono)\s*(?:de\s+)?(?:\$|clp|usd|usdt)?\s*([\d.,]+)/i,
  /(?:cargo\s+)?(?:\$|clp|usd)?\s*([\d.,]+)\s*(?:acreditado|ingresado|recibido|depositado)/i,
  /transferencia\s+(?:de\s+)?(?:entrada|ingreso).*?(?:\$|clp|usd)?\s*([\d.,]+)/i,
  /pago\s+recibido.*?(?:\$|clp|usd)?\s*([\d.,]+)/i,
];

// Patrones con moneda explícita para EXPENSE. currency=null = inferir del texto.
const EXPENSE_PATTERNS: { re: RegExp; currency: string | null }[] = [
  // Pago de Tarjeta de Crédito Internacional: capturar monto CLP (ej: $39.428)
  { re: /pago\s+de\s+tarjeta[^$]*\$([\d.]+)/i, currency: "CLP" },
  // Campo "Monto $39.428" que aparece explícitamente en snippet de Banco de Chile
  { re: /\bmonto\b[^$]*\$([\d.]+)/i, currency: "CLP" },
  // Monto USD en formato USD$43,24 (solo cuando no hay patrón CLP previo)
  { re: /USD\$([\d.,]+)/i, currency: "USD" },
  { re: /(?:compra|pago|cargo|d[eé]bito|retiro|env[ií]o)\s+(?:aprobado|realizado|procesado)?.*?(?:\$|clp|usd|usdt)?\s*([\d.,]+)/i, currency: null },
  { re: /(?:\$|clp|usd)?\s*([\d.,]+)\s*(?:pagado|debitado|cobrado|cargado)/i, currency: null },
  { re: /transferencia\s+(?:enviada|saliente).*?(?:\$|clp|usd)?\s*([\d.,]+)/i, currency: null },
];

const BANK_SENDERS = [
  // Banco de Chile
  { domain: "bancochile.cl", name: "Banco de Chile" },
  { domain: "bancochile.com", name: "Banco de Chile" },
  // Falabella
  { domain: "bancofalabella.cl", name: "Banco Falabella" },
  { domain: "falabella.cl", name: "Banco Falabella" },
  // Santander
  { domain: "santander.cl", name: "Banco Santander" },
  // Ripley
  { domain: "bancoripley.cl", name: "Banco Ripley" },
  // Tenpo
  { domain: "tenpo.cl", name: "Tenpo" },
  // BancoEstado
  { domain: "bancoestado.cl", name: "BancoEstado" },
  // BCI / Mach
  { domain: "bci.cl", name: "BCI" },
  { domain: "mach.bci.cl", name: "MACH" },
  // BTG
  { domain: "btgpactual.cl", name: "BTG Pactual" },
  // Binance
  { domain: "binance.com", name: "Binance" },
  // Bancos adicionales
  { domain: "scotiabank.cl",    name: "Scotiabank" },
  { domain: "itau.cl",          name: "Itaú" },
  { domain: "bancosecurity.cl", name: "Banco Security" },
  { domain: "security.cl",      name: "Banco Security" },
  { domain: "coopeuch.cl",      name: "Coopeuch" },
  // Pasarela de pago de servicios (Khipu envía comprobantes de pago)
  { domain: "khipu.com",        name: "Khipu" },
];

function parseAmount(raw: string): number | null {
  // Formato chileno: 1.234.567 (puntos = miles, sin decimales) o 1.234,56 (coma = decimal)
  // Detectar si hay coma decimal: si el raw tiene coma Y el fragmento tras la coma tiene ≤2 dígitos
  const hasCommaDecimal = /,\d{1,2}$/.test(raw.trim());
  let cleaned: string;
  if (hasCommaDecimal) {
    // Ej: "43,24" o "1.234,56" → quitar puntos de miles, reemplazar coma por punto
    cleaned = raw.replace(/\./g, "").replace(",", ".");
  } else {
    // Ej: "39.428" o "1.234.567" → puntos son miles, no hay decimales
    cleaned = raw.replace(/\./g, "").replace(",", "");
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function detectCurrency(text: string): string {
  if (/usdt/i.test(text)) return "USDT";
  if (/usd\$|usd\s|us\$/i.test(text)) return "USD";
  return "CLP";
}

function extractBankName(from: string): string {
  for (const b of BANK_SENDERS) {
    if (from.toLowerCase().includes(b.domain)) return b.name;
  }
  return "Banco desconocido";
}

export function parseEmailTransaction(
  gmailMessageId: string,
  subject: string,
  snippet: string,
  from: string,
  receivedAt: Date
): ParsedEmailTx | null {
  const text = `${subject} ${snippet}`;
  const normalizedText = normalize(text);
  const subjectNorm = normalize(subject);

  // Fast path: clasificación por subject (alta precisión — bancos CL son consistentes)
  const SUBJECT_INCOME_KW = [
    "transferencia recibida", "abono recibido", "deposito recibido",
    "recibiste", "te abonamos", "ingreso recibido", "recarga exitosa",
    "pago recibido",
  ];
  const SUBJECT_EXPENSE_KW = [
    "pago de tarjeta", "pago tc", "compra aprobada", "compra con tarjeta",
    "transferencia enviada", "pago de servicio", "cargo automatico",
    "pago realizado", "pago efectuado", "retiro", "giro",
    "pago tarjeta de credito", "pago tarjeta credito",
  ];

  let amount: number | null = null;
  let matchedCurrency: string | null = null;

  // Determinar tipo inicial desde el subject (sin necesitar regex de monto)
  let type: "INCOME" | "EXPENSE" = "EXPENSE";
  let confidence: "high" | "medium" | "low" = "low";
  if (SUBJECT_INCOME_KW.some((k) => subjectNorm.includes(k))) {
    type = "INCOME";
    confidence = "high";
  } else if (SUBJECT_EXPENSE_KW.some((k) => subjectNorm.includes(k))) {
    type = "EXPENSE";
    confidence = "high";
  }

  // Extraer monto (siempre necesario independiente del fast path)
  // Si el subject ya fijó tipo INCOME, solo buscar monto; no cambiar el tipo
  if (type === "INCOME") {
    for (const pattern of INCOME_PATTERNS) {
      const match = text.match(pattern);
      if (match?.[1]) {
        amount = parseAmount(match[1]);
        if (amount) break;
      }
    }
    // Fallback genérico para INCOME si los patrones específicos no matchearon
    if (!amount) {
      const genericMatch = text.match(/(?:\$|CLP)\s*([\d.,]+)/);
      if (genericMatch?.[1]) amount = parseAmount(genericMatch[1]);
    }
  } else {
    // Tipo EXPENSE o aún sin determinar — probar patrones INCOME primero
    if (confidence === "low") {
      for (const pattern of INCOME_PATTERNS) {
        const match = text.match(pattern);
        if (match?.[1]) {
          amount = parseAmount(match[1]);
          if (amount) { type = "INCOME"; confidence = "high"; break; }
        }
      }
    }
    // Luego patrones EXPENSE
    if (!amount) {
      for (const { re, currency: patternCurrency } of EXPENSE_PATTERNS) {
        const match = text.match(re);
        if (match?.[1]) {
          amount = parseAmount(match[1]);
          if (amount) {
            type = "EXPENSE";
            confidence = "high";
            matchedCurrency = patternCurrency;
            break;
          }
        }
      }
    }
    // Fallback genérico
    if (!amount) {
      const genericMatch = text.match(/(?:\$|CLP|USD)\s*([\d.,]+)/);
      if (genericMatch?.[1]) {
        amount = parseAmount(genericMatch[1]);
        confidence = "low";
        if (/(recib|abon|ingres|dep[oó]sito)/i.test(normalizedText)) {
          type = "INCOME";
        }
      }
    }
  }

  if (!amount || amount <= 0) return null;

  // Sanity check: montos raros
  if (amount < 1 || amount > 500_000_000) return null;

  // Usar moneda del patrón si fue explícita; si no, inferir del texto completo
  const currency = matchedCurrency ?? detectCurrency(text);
  const bankName = extractBankName(from);

  return {
    amount,
    type,
    description: `${bankName}: ${subject.slice(0, 100)}`,
    date: receivedAt,
    currency,
    confidence,
    rawSubject: subject,
    rawSnippet: snippet,
    gmailMessageId,
    receivedAt,
  };
}

export function isBankEmail(from: string): boolean {
  const fromLower = from.toLowerCase();
  return BANK_SENDERS.some((b) => fromLower.includes(b.domain));
}

// Query con keyword parcial — Gmail soporta matching parcial en from:
// Esto captura cualquier remitente cuya dirección contenga alguno de estos términos
// Cubre: serviciostransferencias@bancochile.cl, notificaciones@bci.cl, comprobantes@khipu.com, etc.
export const GMAIL_QUERY =
  "from:(bancochile OR banco OR bci OR santander OR falabella OR estado OR " +
  "scotiabank OR itau OR security OR tenpo OR ripley OR coopeuch OR binance OR btgpactual OR khipu)";
