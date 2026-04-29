import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ExtractedTransaction {
  amount: number;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  description: string;
  date: Date;
  currency: string;
  confidence: "high" | "medium" | "low";
  documentType?: "voucher" | "statement" | "receipt";
  // Metadata estructurada del comprobante
  transactionId?: string | null;
  counterpartyName?: string | null;
  counterpartyRut?: string | null;
  counterpartyAccount?: string | null;
  counterpartyBank?: string | null;
  // Cuenta DEL TITULAR del comprobante (para auto-asociar al Account del usuario)
  // EXPENSE: cuenta_origen (donde sale la plata) | INCOME: cuenta_abono (donde llega)
  ownerAccount?: string | null;
}

const EXTRACTION_PROMPT = `Eres un experto en procesamiento de documentos financieros chilenos y OCR. Analiza la imagen del comprobante adjunta y extrae la información estructurada con la mayor precisión posible.

REGLAS DE PROCESAMIENTO:

Monto: extraer SOLO el valor numérico. Eliminar el signo "$" y los puntos de miles.
- "$250.000" → 250000
- "$28.393" → 28393
- "USD$43,24" → 43.24 (la coma es decimal)
- En Chile el punto es separador de miles, NO decimal

Fechas: normalizar a "YYYY-MM-DD". Hora a "HH:mm:ss".
- "27 de abril 2026" → "2026-04-27"
- "27/04/2026" → "2026-04-27"
- "15:55 hrs" → "15:55:00"

RUT: mantener formato original con puntos y guión verificador (ej: "26.952.482-0").

ID de transacción: si está fragmentado en varias líneas (ej: "TEFMBCO260427155530457008" + "2240"), CONCATENARLO sin espacios → "TEFMBCO2604271555304570082240".

Campos vacíos: devolver null. NUNCA inventes datos. Limpia espacios al inicio/final de strings.

DETECCIÓN DEL TIPO DE DOCUMENTO Y DIRECCIÓN:

documentType:
- "voucher" → comprobante de transferencia electrónica
- "statement" → estado de cuenta de tarjeta de crédito
- "receipt" → boleta o factura

type (dirección del dinero, desde la perspectiva del titular del comprobante):
- "EXPENSE" → texto contiene "Traspaso a:", "Transferencia enviada", "Pago a", "Cargo por", "Pago de Tarjeta", "Compra"
- "INCOME"  → texto contiene "Traspaso de:", "Transferencia recibida", "Abono de", "Depósito de", "Recibiste"
- "TRANSFER" → solo si explícitamente dice "Traspaso entre cuentas propias"

Si dice solo "Movimiento Exitoso" + "Cargo por pago tc" → "EXPENSE".
Si es estado de cuenta con saldo a pagar → "EXPENSE", con saldo a favor → "INCOME".

CONFIANZA (campo "confianza"):
- "alta": todos los campos críticos legibles y consistentes
- "media": algún campo borroso o inferido
- "baja": imagen borrosa, datos parciales, o documento incompleto

REGLAS PARA PAGO DE TARJETA DE CRÉDITO:
- Usar descripcion = "Pago Tarjeta de Crédito" (o lo que diga el documento)
- Dejar nombre_destinatario, rut_destinatario, cuenta_abono como null si no aparecen
- transactionId si lo trae

DIFERENCIAR FECHAS:
- fecha_movimiento = fecha lógica del movimiento (ej. "Fecha movimiento")
- fecha_hora_comprobante = fecha+hora de emisión al pie (ej. "Fecha y hora")

REGLA CRÍTICA — NUNCA RECHACES UNA IMAGEN:
- Si ves CUALQUIER monto en pesos junto a un movimiento, es un documento válido.
- Los screenshots, capturas de pantalla, fotos de la pantalla de otro celular y vouchers compartidos por apps bancarias TAMBIÉN son válidos.
- Distintos bancos usan distintas etiquetas. Acepta variantes:
  • "Pagado a", "Traspaso a", "Transferencia a" → destinatario
  • "Pagado por", "Traspaso de", "Recibido de" → origen
  • "Cuenta destino", "Cuenta Destinatario", "Cuenta Abono" → cuenta_abono
  • "Cuenta origen", "Desde la cuenta" → cuenta_origen
  • "Banco destino", "Banco" + cuenta destino → banco_destino
  • "Transacción", "Id transaccion", "Nº comprobante" → id_transaccion
- Si UN campo no se ve, déjalo null. NO inventes.
- Si la imagen claramente no es financiera (paisaje, selfie, comida): aun así responde el JSON, con monto=0 y confianza="baja". El sistema decidirá qué hacer.

FORMATO DE SALIDA EXACTO (responde SOLO el JSON, sin texto adicional ni bloques de código):

{
  "transaccion": {
    "documentType": "voucher" | "statement" | "receipt",
    "type": "EXPENSE" | "INCOME" | "TRANSFER",
    "currency": "CLP" | "USD" | "USDT",
    "monto": 0,
    "descripcion": null,
    "fecha_movimiento": null,
    "nombre_origen": null,
    "rut_origen": null,
    "cuenta_origen": null,
    "nombre_destinatario": null,
    "rut_destinatario": null,
    "cuenta_abono": null,
    "banco_destino": null,
    "id_transaccion": null,
    "fecha_hora_comprobante": null,
    "confianza": "alta" | "media" | "baja"
  }
}`;

/**
 * Strips markdown code fences from a string that may wrap JSON.
 */
function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

interface RawTransaccion {
  documentType?: string;
  type?: string;
  currency?: string;
  monto?: number | string;
  descripcion?: string;
  fecha_movimiento?: string;
  nombre_origen?: string | null;
  rut_origen?: string | null;
  cuenta_origen?: string | null;
  nombre_destinatario?: string | null;
  rut_destinatario?: string | null;
  cuenta_abono?: string | null;
  banco_destino?: string | null;
  id_transaccion?: string | null;
  fecha_hora_comprobante?: string;
  confianza?: string;
}

function parseAmount(raw: number | string | undefined): number {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string") return NaN;
  const trimmed = raw.trim().replace(/[^\d.,]/g, "");
  // Si el último separador es coma con 1-2 dígitos, es decimal
  const hasCommaDecimal = /,\d{1,2}$/.test(trimmed);
  const cleaned = hasCommaDecimal
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed.replace(/\./g, "").replace(",", "");
  return parseFloat(cleaned);
}

function parseDate(fechaMovimiento?: string, fechaHoraCompr?: string): Date {
  // Preferir fecha+hora del comprobante; fallback a fecha_movimiento
  const candidates = [fechaHoraCompr, fechaMovimiento].filter(Boolean) as string[];
  for (const c of candidates) {
    // Reemplaza espacio por T para que Date acepte "2026-04-27 15:52:00" como ISO-ish
    const normalized = c.includes("T") ? c : c.replace(" ", "T");
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

function mapTransaccionToExtracted(t: RawTransaccion): ExtractedTransaction {
  const rawAmount = parseAmount(t.monto);
  // Si no hay monto, mantenerlo en 0 para que el flujo de "datos faltantes"
  // lo capture y pida al usuario reenviar/cancelar.
  const amount = isNaN(rawAmount) || rawAmount < 0 ? 0 : rawAmount;

  const docType = String(t.documentType ?? "voucher");
  const documentType: "voucher" | "statement" | "receipt" =
    docType === "statement" ? "statement" :
    docType === "receipt"  ? "receipt"  : "voucher";

  const txTypeRaw = String(t.type ?? "EXPENSE").toUpperCase();
  const type: "EXPENSE" | "INCOME" | "TRANSFER" =
    txTypeRaw === "INCOME"   ? "INCOME"   :
    txTypeRaw === "TRANSFER" ? "TRANSFER" : "EXPENSE";

  const confRaw = String(t.confianza ?? "media").toLowerCase();
  const confidence: "high" | "medium" | "low" =
    confRaw === "alta" ? "high" :
    confRaw === "baja" ? "low"  : "medium";

  // Construir descripción priorizando descripcion explícita
  let description = (t.descripcion ?? "").trim();
  if (!description) {
    if (type === "INCOME" && t.nombre_origen) description = `Depósito de ${t.nombre_origen}`;
    else if (type === "EXPENSE" && t.nombre_destinatario) description = `Pago a ${t.nombre_destinatario}`;
    else description = documentType === "statement" ? "Pago Tarjeta de Crédito" : "Movimiento bancario";
  }
  if (description.length > 100) description = description.slice(0, 100);

  return {
    amount,
    type,
    description,
    date: parseDate(t.fecha_movimiento, t.fecha_hora_comprobante),
    currency: (t.currency ?? "CLP").toUpperCase(),
    confidence,
    documentType,
    transactionId: t.id_transaccion?.replace(/\s+/g, "") || null,
    counterpartyName: type === "INCOME" ? (t.nombre_origen ?? null) : (t.nombre_destinatario ?? null),
    counterpartyRut: type === "INCOME" ? (t.rut_origen ?? null) : (t.rut_destinatario ?? null),
    counterpartyAccount: type === "INCOME" ? (t.cuenta_origen ?? null) : (t.cuenta_abono ?? null),
    counterpartyBank: t.banco_destino ?? null,
    // Cuenta del titular: lo opuesto al counterpartyAccount
    ownerAccount: type === "INCOME" ? (t.cuenta_abono ?? null) : (t.cuenta_origen ?? null),
  };
}

export async function extractTransactionFromImage(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<ExtractedTransaction | null> {
  try {
    console.log("[Gemini Vision] Iniciando extracción. mimeType:", mimeType, "imageBase64 length:", imageBase64.length);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      {
        inlineData: { data: imageBase64, mimeType },
      },
    ]);

    const rawText = result.response.text();
    console.log("[Gemini Vision] Respuesta raw de Gemini:", rawText.slice(0, 1000));

    const jsonText = stripCodeFences(rawText.trim());

    let parsed: { transaccion?: RawTransaccion; error?: string };
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("[Gemini Vision] Error parseando JSON:", parseError, "| Texto:", jsonText.slice(0, 500));
      return null;
    }

    // Si Gemini igual respondió error a pesar del prompt, generar struct vacío
    // para que el flujo de "datos faltantes" guíe al usuario
    if (parsed.error || !parsed.transaccion) {
      console.warn("[Gemini Vision] Sin transaccion en respuesta, devolviendo struct vacío:", parsed.error ?? jsonText.slice(0, 200));
      return {
        amount: 0,
        type: "EXPENSE",
        description: "",
        date: new Date(),
        currency: "CLP",
        confidence: "low",
        documentType: "voucher",
      };
    }

    const extracted = mapTransaccionToExtracted(parsed.transaccion);

    console.log("[Gemini Vision] Extracción OK:", {
      amount: extracted.amount,
      type: extracted.type,
      txId: extracted.transactionId,
      counterparty: extracted.counterpartyName,
      confidence: extracted.confidence,
    });

    return extracted;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Gemini Vision] Error inesperado:", msg, error);
    return null;
  }
}
