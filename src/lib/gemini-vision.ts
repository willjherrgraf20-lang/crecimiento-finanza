import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ExtractedTransaction {
  amount: number;
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  description: string;
  date: Date;
  currency: string;
  confidence: "high" | "medium" | "low";
}

const EXTRACTION_PROMPT = `Analiza esta imagen de un comprobante de transferencia o movimiento bancario chileno.
Extrae la siguiente información y responde ÚNICAMENTE con un JSON válido, sin texto adicional:

{
  "amount": <número sin puntos ni comas, solo dígitos y punto decimal si aplica>,
  "type": <"EXPENSE" si es un pago/gasto/transferencia enviada, "INCOME" si es un depósito/ingreso recibido, "TRANSFER" si es entre cuentas propias>,
  "description": <descripción corta del movimiento, máximo 100 caracteres>,
  "date": <fecha en formato ISO 8601, ej: "2024-01-15T00:00:00.000Z". Si no hay fecha clara, usa la fecha de hoy>,
  "currency": <"CLP" para pesos chilenos, "USD" para dólares, "USDT" para tether>,
  "confidence": <"high" si tienes certeza de los datos, "medium" si hay dudas menores, "low" si la imagen no es clara>
}

Si la imagen NO es un comprobante bancario o no puedes extraer datos con mínima confianza, responde:
{"error": "No es un comprobante válido"}`;

export async function extractTransactionFromImage(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<ExtractedTransaction | null> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      },
      EXTRACTION_PROMPT,
    ]);

    const responseText = result.response.text().trim();

    // Limpiar markdown code blocks si los hay
    const jsonText = responseText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(jsonText);

    if (parsed.error) {
      console.log("[Gemini] No es comprobante válido:", parsed.error);
      return null;
    }

    return {
      amount: parseFloat(String(parsed.amount).replace(/[^\d.]/g, "")),
      type: parsed.type ?? "EXPENSE",
      description: parsed.description ?? "Movimiento bancario",
      date: new Date(parsed.date ?? Date.now()),
      currency: parsed.currency ?? "CLP",
      confidence: parsed.confidence ?? "medium",
    };
  } catch (error) {
    console.error("[Gemini Vision] Error al procesar imagen:", error);
    return null;
  }
}
