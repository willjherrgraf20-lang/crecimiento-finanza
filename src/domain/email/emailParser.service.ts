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

/**
 * Toma la primera captura no-vacía de varios regex sobre un texto.
 * Limpia espacios extra al inicio/final del resultado.
 */
function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const v = m[1].trim().replace(/\s+/g, " ");
      if (v) return v;
    }
  }
  return null;
}

/**
 * ID de transacción tipo Banco de Chile / BCI (TEFMBCO..., TEFMPGO...) puede venir
 * partido en dos líneas en el snippet. Esta regex tolera salto de línea/espacio
 * intermedio y luego concatena los fragmentos.
 */
function extractTransactionId(text: string): string | null {
  // Formato BdC/BCI: TEF + 3 letras + dígitos largos (eventualmente con espacio en medio)
  const tef = text.match(/\b(TEF[A-Z]{3}\d[\d\s]{15,})/i);
  if (tef?.[1]) return tef[1].replace(/\s+/g, "");

  // Formato genérico: "Id transaccion: XXXXX" / "Nº comprobante: XXXX"
  const labeled = firstMatch(text, [
    /(?:id\s+transacci[oó]n|n[uú]mero\s+(?:de\s+)?(?:transacci[oó]n|comprobante|operaci[oó]n))[:\s]+([A-Z0-9-]{6,})/i,
    /(?:n[uú]mero|c[oó]digo)\s+(?:de\s+)?(?:operaci[oó]n|referencia|comprobante)[:\s]+([A-Z0-9-]{6,})/i,
    /\bn[°º]\s+(?:operaci[oó]n|referencia|comprobante|tr[aá]mite)[:\s]+([A-Z0-9-]{6,})/i,
  ]);
  if (labeled) return labeled.replace(/\s+/g, "");

  return null;
}

function extractRut(text: string, near?: RegExp): string | null {
  // Formato chileno: 1-8 dígitos + opcional puntos + guión + dígito o K
  const RUT_RE = /(\d{1,2}\.\d{3}\.\d{3}-[\dKk]|\d{7,8}-[\dKk])/;
  if (near) {
    const ctx = text.match(new RegExp(near.source + "[\\s\\S]{0,80}?" + RUT_RE.source, "i"));
    if (ctx?.[1]) return ctx[1].toUpperCase();
  }
  const m = text.match(RUT_RE);
  return m?.[1] ? m[1].toUpperCase() : null;
}

function extractCounterpartyName(text: string, type: "INCOME" | "EXPENSE"): string | null {
  // Para EXPENSE: "Traspaso a/Pago a/Transferencia a/Pagado a NOMBRE"
  // Para INCOME:  "Traspaso de/Recibido de/Depósito de/Pagado por NOMBRE"
  const patterns = type === "INCOME"
    ? [
        /(?:traspaso\s+de|transferencia\s+de|abono\s+de|dep[oó]sito\s+de|recibido\s+de|pagado\s+por|recibiste\s+(?:un\s+)?(?:abono|dep[oó]sito)\s+de)[:\s]+([A-ZÁÉÍÓÚÑ][^\n$\d]{2,60}?)(?=\s*(?:\n|por|rut|cuenta|monto|$|\d{2}\.))/i,
      ]
    : [
        /(?:traspaso\s+a|transferencia\s+a|pago\s+a|pagado\s+a|env[ií]o\s+a)[:\s]+([A-ZÁÉÍÓÚÑ][^\n$\d]{2,60}?)(?=\s*(?:\n|por|rut|cuenta|monto|$|\d{2}\.))/i,
      ];
  return firstMatch(text, patterns);
}

function extractAccountNumber(text: string, labels: string[]): string | null {
  // Etiqueta + número (con posibles asteriscos para enmascarado tipo "****1177")
  for (const lab of labels) {
    const re = new RegExp(`${lab}\\s*[:\\-]?\\s*([0-9*]{4,}(?:[\\s-]?[0-9*]{2,})*)`, "i");
    const m = text.match(re);
    if (m?.[1]) return m[1].trim().replace(/\s+/g, "");
  }
  return null;
}

interface VoucherMetadata {
  transactionId: string | null;
  counterpartyName: string | null;
  counterpartyRut: string | null;
  counterpartyAccount: string | null;
  counterpartyBank: string | null;
  ownerAccount: string | null;
}

/**
 * Extrae metadata enriquecida del email (RUT, cuentas, ID transacción).
 * Diseñado para tolerar ausencia de cualquier campo — todos quedan en null si
 * no se encuentran. NUNCA inventa datos.
 */
function extractVoucherMetadata(text: string, type: "INCOME" | "EXPENSE"): VoucherMetadata {
  const transactionId = extractTransactionId(text);
  const counterpartyName = extractCounterpartyName(text, type);

  // RUT con preferencia por el "Rut origen/destinatario" según dirección
  const rutNearLabel = type === "INCOME"
    ? /rut\s+(?:origen|del?\s+(?:remitente|emisor))/i
    : /rut\s+(?:destinatario|del?\s+(?:beneficiario|receptor))/i;
  const counterpartyRut = extractRut(text, rutNearLabel) ?? extractRut(text);

  const counterpartyAccount = type === "INCOME"
    ? extractAccountNumber(text, ["cuenta\\s+origen", "desde\\s+la\\s+cuenta"])
    : extractAccountNumber(text, ["cuenta\\s+abono", "cuenta\\s+destinatari[oa]", "cuenta\\s+destino", "cuenta\\s+vista"]);

  const ownerAccount = type === "INCOME"
    ? extractAccountNumber(text, ["cuenta\\s+abono", "tu\\s+cuenta\\s+(?:vista|corriente)", "cuenta\\s+(?:de\\s+)?dep[oó]sito"])
    : extractAccountNumber(text, ["cuenta\\s+origen", "desde\\s+(?:tu\\s+)?cuenta", "cuenta\\s+cargo"]);

  // Banco destino: aparece como "Banco destino: XXX" o "Banco: XXX" cuando el destinatario es de otro banco
  const counterpartyBank = firstMatch(text, [
    /banco\s+destino[:\s]+([A-ZÁÉÍÓÚÑ][^\n$\d]{2,40}?)(?=\s*(?:\n|cuenta|rut|monto|$))/i,
  ]);

  return { transactionId, counterpartyName, counterpartyRut, counterpartyAccount, counterpartyBank, ownerAccount };
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

  // Metadata extra: RUT, cuentas, ID — null si no se detectan, NO se inventa
  const meta = extractVoucherMetadata(text, type);

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
    transactionId: meta.transactionId,
    counterpartyName: meta.counterpartyName,
    counterpartyRut: meta.counterpartyRut,
    counterpartyAccount: meta.counterpartyAccount,
    counterpartyBank: meta.counterpartyBank ?? (bankName !== "Banco desconocido" ? bankName : null),
    ownerAccount: meta.ownerAccount,
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
