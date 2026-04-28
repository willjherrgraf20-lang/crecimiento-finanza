import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ExtractedTransaction {
  amount: number;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  description: string;
  date: Date;
  currency: string;
  confidence: "high" | "medium" | "low";
  documentType?: "voucher" | "statement";
}

const EXTRACTION_PROMPT = `Analiza esta imagen. Puede ser un comprobante bancario, una transferencia, o un estado de cuenta de tarjeta de crédito chilena.

Determina el tipo de documento:
- "voucher": comprobante de transferencia, pago o movimiento individual
- "statement": estado de cuenta de tarjeta de crédito (con múltiples movimientos, saldo total, fecha de vencimiento)

Para un VOUCHER extrae el monto de la transacción individual.
Para un ESTADO DE CUENTA extrae el TOTAL A PAGAR (monto mínimo NO, el total). Si hay saldo a favor del cliente, el type debe ser "INCOME"; en caso contrario "EXPENSE".

Responde ÚNICAMENTE con un JSON válido, sin texto adicional, sin bloques de código markdown:

{
  "documentType": <"voucher" o "statement">,
  "amount": <número sin puntos de miles, solo dígitos y punto decimal si aplica. Ej: 150000 o 1250.50>,
  "type": <"EXPENSE" si es un pago/gasto/deuda, "INCOME" si es un depósito/ingreso/saldo a favor, "TRANSFER" si es entre cuentas propias>,
  "description": <descripción corta del movimiento o del emisor de la tarjeta, máximo 100 caracteres>,
  "date": <para voucher: fecha de la transacción. Para estado de cuenta: fecha de vencimiento/pago. Formato ISO 8601 "2024-01-15T00:00:00.000Z". Si no hay fecha clara, usa la fecha de hoy>,
  "currency": <"CLP" para pesos chilenos, "USD" para dólares, "USDT" para tether>,
  "confidence": <"high" si tienes certeza de los datos, "medium" si hay dudas menores, "low" si la imagen no es clara>
}

Si la imagen no es ninguno de los documentos mencionados y no puedes extraer datos financieros con mínima confianza, responde exactamente:
{"error": "No es un documento financiero válido"}`;

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

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      },
      EXTRACTION_PROMPT,
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
      return null;
    }

    if (parsed.error) {
      console.log("[Gemini Vision] Gemini rechazó la imagen:", parsed.error);
      return null;
    }

    const documentType = (parsed.documentType === "statement" ? "statement" : "voucher") as "voucher" | "statement";

    return {
      amount: parseFloat(String(parsed.amount).replace(/[^\d.]/g, "")),
      type: (parsed.type as "EXPENSE" | "INCOME" | "TRANSFER") ?? "EXPENSE",
      description: (parsed.description as string) ?? "Movimiento bancario",
      date: new Date((parsed.date as string) ?? Date.now()),
      currency: (parsed.currency as string) ?? "CLP",
      confidence: (parsed.confidence as "high" | "medium" | "low") ?? "medium",
      documentType,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Gemini Vision] Error inesperado al procesar imagen:", msg, error);
    return null;
  }
}
