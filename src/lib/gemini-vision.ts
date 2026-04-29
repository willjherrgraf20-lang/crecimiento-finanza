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
}

const EXTRACTION_PROMPT = `Eres un experto en procesamiento de comprobantes bancarios y financieros chilenos. Analiza esta imagen y extrae los datos.

REGLA GENERAL: Si la imagen muestra un monto en pesos ($) o cualquier moneda junto a un movimiento bancario, es un documento financiero válido. NO la rechaces.

ENCABEZADOS COMUNES EN BANCOS CHILENOS (cualquiera = documento válido):
- "Transferencia exitosa" / "Transferencia electrónica"
- "Movimiento Exitoso" / "Movimiento exitoso"
- "Comprobante de transferencia" / "Comprobante de pago" / "Comprobante"
- "Pago exitoso" / "Pago realizado" / "Pago de Tarjeta"
- "Depósito" / "Abono"
- "Estado de cuenta" / "Saldo a pagar"

CÓMO DETERMINAR EL TIPO (type):
- Texto contiene "Traspaso a:" o "Transferencia a" o "Pago a" o "Cargo" → "EXPENSE"
- Texto contiene "Traspaso de:" o "Transferencia de" o "Abono de" o "Depósito de" o "Recibiste" → "INCOME"
- Si el documento es un Estado de cuenta de tarjeta y muestra "Total a pagar" o "Monto a pagar" → "EXPENSE"
- Si es un Estado de cuenta con saldo a favor → "INCOME"
- Si dice solo "Movimiento Exitoso" + "Cargo por pago tc" → "EXPENSE" (es un cargo)

CÓMO DETERMINAR documentType:
- "voucher" → comprobante de transferencia bancaria con campos como Monto + Cuenta Origen/Destinatario + Rut
- "statement" → estado de cuenta de tarjeta de crédito con totales y fechas de vencimiento
- "receipt" → boleta o factura de compra

EXTRACCIÓN DEL MONTO:
- En Chile el formato es "$1.500.000" → 1500000 (los puntos son separadores de miles, NO decimales)
- Si ves "$28.393" debe parsearse como 28393 (no 28.393)
- Si hay coma decimal "$1.234,56" → 1234.56
- Si el documento muestra varios montos (ej. estado de cuenta), usa el campo "Monto" principal o "Total a pagar"
- Si es un voucher con "Monto $X" y también "USD$Y", usa el monto principal en CLP

EXTRACCIÓN DE FECHA:
- Busca campos como "Fecha movimiento", "Fecha y hora", "Fecha"
- Formatos comunes: "27 de abril 2026", "27/04/2026", "27-04-2026"
- Convertir a ISO 8601 "2026-04-27T15:55:00.000Z"
- Si no hay fecha clara, usa la fecha actual

DESCRIPCIÓN (máximo 100 caracteres):
- Si hay campo "Descripción" en el comprobante, úsalo (ej: "Traspaso a: hardware chile spa")
- Si es pago de TC: "Pago Tarjeta de Crédito"
- Si es transferencia: "Transferencia a [nombre]" o "Depósito de [nombre]"
- Si no hay info clara: usa el banco emisor + tipo

INSTRUCCIONES ESTRICTAS:
1. Responde SOLO con JSON válido, sin texto adicional ni bloques de código
2. El monto debe ser número (no string), sin separadores de miles
3. confidence: "high" si los datos son claros, "medium" si parcialmente legibles, "low" si dudoso
4. Currency: por defecto "CLP" salvo que veas explícitamente "USD" o "USDT"

FORMATO DE RESPUESTA EXACTO:
{
  "documentType": "voucher" | "statement" | "receipt",
  "amount": number,
  "type": "EXPENSE" | "INCOME" | "TRANSFER",
  "description": string,
  "date": string (ISO 8601),
  "currency": "CLP" | "USD" | "USDT",
  "confidence": "high" | "medium" | "low"
}

SOLO devuelve {"error": "..."} si la imagen es totalmente ilegible o claramente NO contiene info financiera (ej: una foto de paisaje, un selfie, etc.).`;

/**
 * Strips markdown code fences from a string that may wrap JSON.
 * Handles both ```json ... ``` and ``` ... ``` variants robustly.
 */
function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
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
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });

    // Intentar con el prompt principal
    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      },
    ]);

    const rawText = result.response.text();
    console.log("[Gemini Vision] Respuesta raw de Gemini:", rawText);

    const jsonText = stripCodeFences(rawText.trim());
    console.log("[Gemini Vision] JSON limpio a parsear:", jsonText);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("[Gemini Vision] Error parseando JSON:", parseError, "| Texto recibido:", jsonText);
      // Intentar con prompt alternativo más simple
      return await extractWithSimplePrompt(imageBase64, mimeType);
    }

    if (parsed.error) {
      console.log("[Gemini Vision] Gemini rechazó la imagen:", parsed.error);
      // Intentar con prompt alternativo más simple
      return await extractWithSimplePrompt(imageBase64, mimeType);
    }

    const docType = String(parsed.documentType);
    const documentType: "voucher" | "statement" | "receipt" = 
      docType === "statement" ? "statement" :
      docType === "receipt" ? "receipt" : "voucher";

    const txType = String(parsed.type);
    const type: "EXPENSE" | "INCOME" | "TRANSFER" = 
      txType === "INCOME" ? "INCOME" :
      txType === "TRANSFER" ? "TRANSFER" : "EXPENSE";

    const conf = String(parsed.confidence);
    const confidence: "high" | "medium" | "low" = 
      conf === "high" ? "high" :
      conf === "low" ? "low" : "medium";

    const amount = parseFloat(String(parsed.amount).replace(/[^\d.]/g, ""));
    if (isNaN(amount) || amount <= 0) {
      console.error("[Gemini Vision] Monto inválido:", parsed.amount);
      return null;
    }

    return {
      amount,
      type,
      description: (parsed.description as string) ?? "Movimiento bancario",
      date: new Date((parsed.date as string) ?? Date.now()),
      currency: (parsed.currency as string) ?? "CLP",
      confidence,
      documentType,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Gemini Vision] Error inesperado al procesar imagen:", msg, error);
    return null;
  }
}

const SIMPLE_PROMPT = `Analiza esta imagen y extrae cualquier información financiera o de transacción.

Si ves un comprobante, boleta, factura, transferencia o cualquier documento con un monto de dinero:
- Extrae el monto total
- Determina si es un gasto (EXPENSE), ingreso (INCOME) o transferencia (TRANSFER)
- Extrae la fecha si es visible
- Describe brevemente el documento

Responde SOLO con JSON válido sin bloques de código:
{
  "amount": number,
  "type": "EXPENSE" | "INCOME" | "TRANSFER",
  "description": string,
  "date": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "currency": "CLP" | "USD",
  "confidence": "high" | "medium" | "low"
}

Si realmente no hay información financiera, responde: {"error": "No es un documento financiero válido"}`;

async function extractWithSimplePrompt(
  imageBase64: string,
  mimeType: string
): Promise<ExtractedTransaction | null> {
  try {
    console.log("[Gemini Vision] Intentando con prompt simple...");
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });

    const result = await model.generateContent([
      SIMPLE_PROMPT,
      {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      },
    ]);

    const rawText = result.response.text();
    console.log("[Gemini Vision] Respuesta prompt simple:", rawText);

    const jsonText = stripCodeFences(rawText.trim());
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error("[Gemini Vision] Error parseando respuesta prompt simple");
      return null;
    }

    if (parsed.error) {
      console.log("[Gemini Vision] Prompt simple también rechazó la imagen");
      return null;
    }

    const amount = parseFloat(String(parsed.amount).replace(/[^\d.]/g, ""));
    if (isNaN(amount) || amount <= 0) {
      return null;
    }

    return {
      amount,
      type: (parsed.type as "EXPENSE" | "INCOME" | "TRANSFER") ?? "EXPENSE",
      description: (parsed.description as string) ?? "Movimiento bancario",
      date: new Date((parsed.date as string) ?? Date.now()),
      currency: (parsed.currency as string) ?? "CLP",
      confidence: "medium" as const,
      documentType: "voucher" as const,
    };
  } catch (error) {
    console.error("[Gemini Vision] Error con prompt simple:", error);
    return null;
  }
}
