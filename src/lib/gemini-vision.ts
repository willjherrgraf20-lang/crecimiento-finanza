import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const FLASH_MODEL = "gemini-2.0-flash";
const PRO_MODEL = "gemini-2.0-pro-exp";

const TARGET_MIN_DIM = 1600;
const TARGET_MAX_DIM = 2200;

export interface ExtractedTransaction {
  amount: number;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  // "" = no detectado. NUNCA se rellena con valores inventados.
  description: string;
  // null = no detectado. El sistema NO inventa la fecha.
  date: Date | null;
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
}

EJEMPLOS DE EXTRACCIÓN CORRECTA (memorízalos):

Ejemplo 1 — Voucher Banco de Chile, transferencia enviada:
Imagen muestra: encabezado "Transferencia exitosa", "Monto $250.000", "Descripción Traspaso a: hardware chile spa", "Fecha movimiento 27 de abril 2026", "Nombre Destinatario Hardware Chile Spa", "Rut Destinatario 77.280.441-5", "Cuenta Destinatario 0000000000097543918", "Rut Origen 26.952.482-0", "Cuenta Origen 001696993900", "Banco Banco BCI", "Id transaccion TEFMBCO260427155530457008 2240" (en dos líneas), "Fecha y hora 27 de abril 2026 15:55 hrs.", logo BANCO DE CHILE.

Salida correcta:
{"transaccion":{"documentType":"voucher","type":"EXPENSE","currency":"CLP","monto":250000,"descripcion":"Traspaso a: hardware chile spa","fecha_movimiento":"2026-04-27","nombre_origen":null,"rut_origen":"26.952.482-0","cuenta_origen":"001696993900","nombre_destinatario":"Hardware Chile Spa","rut_destinatario":"77.280.441-5","cuenta_abono":"0000000000097543918","banco_destino":"Banco BCI","id_transaccion":"TEFMBCO2604271555304570082240","fecha_hora_comprobante":"2026-04-27 15:55:00","confianza":"alta"}}

Ejemplo 2 — Voucher BCI, transferencia enviada (formato distinto):
Imagen muestra: encabezado "Comprobante de Transferencia", "Transferencia exitosa", "Pagado a Jose Rodriguez", "Cuenta destino Cuenta Vista ****1177", "Banco destino Prepago Los Heroes", "Monto $100.000", "Fecha y hora 29 de abril del 2026 14:33 hrs.", "Transacción TEFMBCO260429143330462564367".

Salida correcta:
{"transaccion":{"documentType":"voucher","type":"EXPENSE","currency":"CLP","monto":100000,"descripcion":"Pagado a Jose Rodriguez","fecha_movimiento":"2026-04-29","nombre_origen":null,"rut_origen":null,"cuenta_origen":null,"nombre_destinatario":"Jose Rodriguez","rut_destinatario":null,"cuenta_abono":"Cuenta Vista ****1177","banco_destino":"Prepago Los Heroes","id_transaccion":"TEFMBCO260429143330462564367","fecha_hora_comprobante":"2026-04-29 14:33:00","confianza":"alta"}}

Notas de los ejemplos:
- El "Banco" del Ejemplo 1 era el banco DEL DESTINATARIO (BCI) → va en banco_destino. El comprobante mismo era de Banco de Chile (logo) → eso no se incluye en la salida.
- En el Ejemplo 2 los campos de RUT no aparecen → quedan null (NUNCA inventar).
- El id_transaccion del Ejemplo 1 venía partido en dos líneas → CONCATENAR sin espacios.
- Las cuentas con asteriscos (****1177) se mantienen literalmente.`;

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

function parseDate(fechaMovimiento?: string | null, fechaHoraCompr?: string | null): Date | null {
  // Preferir fecha+hora del comprobante; fallback a fecha_movimiento.
  // Si Gemini no detectó fecha → null (NO inventar "hoy").
  const candidates = [fechaHoraCompr, fechaMovimiento].filter(Boolean) as string[];
  for (const c of candidates) {
    // Reemplaza espacio por T para que Date acepte "2026-04-27 15:52:00" como ISO-ish
    const normalized = c.includes("T") ? c : c.replace(" ", "T");
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
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

  // Descripción: usar SOLO lo que Gemini extrajo del documento. Si está vacía,
  // se mantiene "" para que el flujo de "datos faltantes" la marque como no detectada.
  // NO se inventa con base en otros campos.
  let description = (t.descripcion ?? "").trim();
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

/**
 * Normaliza la imagen para mejorar la lectura OCR de Gemini:
 * - Upscale (Lanczos) si el lado mayor < TARGET_MIN_DIM (texto chico se vuelve legible)
 * - Downscale si > TARGET_MAX_DIM (evita payloads enormes)
 * - normalize() = autocontrast (clave para vouchers con fondo gris claro)
 * - sharpen(sigma=1) = bordes de texto más definidos
 *
 * Si sharp falla por cualquier razón (cold start raro, mimeType no soportado),
 * devuelve el base64 original sin tocar — el preprocesamiento NUNCA bloquea el flujo.
 */
async function preprocessImage(
  imageBase64: string,
  mimeType: string
): Promise<{ base64: string; mimeType: string }> {
  try {
    const inputBuffer = Buffer.from(imageBase64, "base64");
    const meta = await sharp(inputBuffer).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const longSide = Math.max(w, h);

    let pipeline = sharp(inputBuffer);

    if (longSide > 0 && longSide < TARGET_MIN_DIM) {
      const scale = TARGET_MIN_DIM / longSide;
      const newW = Math.round(w * scale);
      const newH = Math.round(h * scale);
      pipeline = pipeline.resize(newW, newH, { kernel: "lanczos3" });
    } else if (longSide > TARGET_MAX_DIM) {
      const scale = TARGET_MAX_DIM / longSide;
      const newW = Math.round(w * scale);
      const newH = Math.round(h * scale);
      pipeline = pipeline.resize(newW, newH, { kernel: "lanczos3" });
    }

    const outputBuffer = await pipeline
      .normalize()
      .sharpen({ sigma: 1.0 })
      .jpeg({ quality: 90 })
      .toBuffer();

    console.log(
      `[Gemini Vision] Preprocesamiento OK: ${w}x${h} ${mimeType} (${inputBuffer.length}B) → JPEG (${outputBuffer.length}B)`
    );

    return {
      base64: outputBuffer.toString("base64"),
      mimeType: "image/jpeg",
    };
  } catch (err) {
    console.warn("[Gemini Vision] Preprocesamiento falló, usando imagen original:", err);
    return { base64: imageBase64, mimeType };
  }
}

/**
 * Llama a Gemini con un modelo específico. Devuelve null si la respuesta no parsea
 * o no contiene el campo `transaccion`. Si Gemini retornó error explícito, también null.
 */
async function runWithModel(
  modelName: string,
  imageBase64: string,
  mimeType: string
): Promise<ExtractedTransaction | null> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent([
    EXTRACTION_PROMPT,
    { inlineData: { data: imageBase64, mimeType } },
  ]);

  const rawText = result.response.text();
  console.log(`[Gemini Vision] (${modelName}) Respuesta raw:`, rawText.slice(0, 800));

  const jsonText = stripCodeFences(rawText.trim());

  let parsed: { transaccion?: RawTransaccion; error?: string };
  try {
    parsed = JSON.parse(jsonText);
  } catch (parseError) {
    console.error(`[Gemini Vision] (${modelName}) Error parseando JSON:`, parseError);
    return null;
  }

  if (parsed.error || !parsed.transaccion) {
    console.warn(`[Gemini Vision] (${modelName}) Sin transaccion:`, parsed.error ?? jsonText.slice(0, 200));
    return null;
  }

  return mapTransaccionToExtracted(parsed.transaccion);
}

/**
 * Score numérico de la calidad de una extracción para elegir entre Flash y Pro.
 * Mayor = mejor.
 */
function scoreExtraction(e: ExtractedTransaction | null): number {
  if (!e) return -1;
  let score = 0;
  if (e.amount > 0) score += 100;
  if (e.confidence === "high") score += 30;
  else if (e.confidence === "medium") score += 15;
  if (e.transactionId) score += 10;
  if (e.counterpartyName) score += 5;
  if (e.date) score += 5;
  if (e.description && e.description.trim().length >= 3) score += 5;
  return score;
}

/**
 * Decide si vale la pena reintentar con Pro.
 * Triggers: monto en 0, confianza baja, o nada extraído.
 */
function shouldFallbackToPro(e: ExtractedTransaction | null): boolean {
  if (!e) return true;
  if (e.amount <= 0) return true;
  if (e.confidence === "low") return true;
  return false;
}

export async function extractTransactionFromImage(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<ExtractedTransaction | null> {
  try {
    console.log(`[Gemini Vision] Iniciando extracción. mimeType=${mimeType} inputLen=${imageBase64.length}`);

    const prep = await preprocessImage(imageBase64, mimeType);

    // Primer intento: Flash (rápido y barato)
    let flash: ExtractedTransaction | null = null;
    try {
      flash = await runWithModel(FLASH_MODEL, prep.base64, prep.mimeType);
    } catch (err) {
      console.error("[Gemini Vision] Flash falló:", err);
    }

    // Si Flash entregó algo aceptable, devolverlo
    if (!shouldFallbackToPro(flash)) {
      console.log("[Gemini Vision] Modelo elegido: flash | score:", scoreExtraction(flash));
      return flash;
    }

    // Fallback: Pro (más caro, más capaz). Solo se activa cuando Flash claramente falló.
    console.log(`[Gemini Vision] Flash con calidad baja (score=${scoreExtraction(flash)}), reintentando con ${PRO_MODEL}…`);
    let pro: ExtractedTransaction | null = null;
    try {
      pro = await runWithModel(PRO_MODEL, prep.base64, prep.mimeType);
    } catch (err) {
      console.error("[Gemini Vision] Pro falló:", err);
    }

    const flashScore = scoreExtraction(flash);
    const proScore = scoreExtraction(pro);

    // Elegir el mejor de los dos por score
    const winner = proScore >= flashScore ? pro : flash;
    const winnerName = proScore >= flashScore ? "pro" : "flash";

    if (winner) {
      console.log(`[Gemini Vision] Modelo elegido: ${winnerName} | flashScore=${flashScore} proScore=${proScore} | amount=${winner.amount} confidence=${winner.confidence}`);
      return winner;
    }

    // Ambos fallaron — devolver struct vacío para que el flujo de "datos faltantes" guíe al usuario
    console.warn("[Gemini Vision] Flash y Pro fallaron. Devolviendo struct vacío.");
    return {
      amount: 0,
      type: "EXPENSE",
      description: "",
      date: null,
      currency: "CLP",
      confidence: "low",
      documentType: "voucher",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Gemini Vision] Error inesperado:", msg, error);
    return null;
  }
}
