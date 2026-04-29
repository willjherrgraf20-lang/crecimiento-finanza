import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { parseEmailTransaction, isBankEmail, GMAIL_QUERY } from "./emailParser.service";
import type { GmailMessage, GmailMessagePart } from "./email.types";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

// ─── Token management ─────────────────────────────────────────────────────────

export async function getValidAccessToken(userId: string): Promise<string> {
  const token = await db.gmailToken.findUnique({ where: { userId } });
  if (!token) throw new Error("Gmail no conectado. Ve a /email/conectar");

  const accessToken = decrypt(token.accessToken);

  // Si el token no ha expirado (con 5 min de margen), retornar directamente
  if (token.expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
    return accessToken;
  }

  // Refresh token
  const refreshToken = decrypt(token.refreshToken);
  const refreshed = await refreshAccessToken(refreshToken);

  // Guardar nuevo access token
  await db.gmailToken.update({
    where: { userId },
    data: {
      accessToken: encrypt(refreshed.access_token),
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  });

  return refreshed.access_token;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error refreshing Gmail token: ${err}`);
  }

  return res.json();
}

export async function saveGmailTokens(
  userId: string,
  tokens: { access_token: string; refresh_token: string; expires_in: number; scope: string; token_type: string }
) {
  await db.gmailToken.upsert({
    where: { userId },
    create: {
      userId,
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
    },
    update: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
    },
  });
}

export async function isGmailConnected(userId: string): Promise<boolean> {
  const token = await db.gmailToken.findUnique({ where: { userId } });
  return !!token;
}

// ─── Email scanning ───────────────────────────────────────────────────────────

export async function scanBankEmails(userId: string): Promise<{
  scanned: number;
  newPending: number;
  skipped: number;
  skippedExists: number;
  skippedNotBank: number;
  skippedNoParse: number;
}> {
  let accessToken = await getValidAccessToken(userId);

  // Buscar emails bancarios (últimos 90 días) — Gmail usa formato YYYY/MM/DD para after:
  const afterDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const afterStr = `${afterDate.getFullYear()}/${String(afterDate.getMonth() + 1).padStart(2, "0")}/${String(afterDate.getDate()).padStart(2, "0")}`;
  const rawQuery = `${GMAIL_QUERY} after:${afterStr}`;
  const q = encodeURIComponent(rawQuery);
  const listUrl = `${GMAIL_API}/messages?q=${q}&maxResults=50`;

  console.log("[Email scan] Gmail query:", rawQuery);

  let listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  console.log("[Email scan] Gmail list status:", listRes.status);

  // Si el token expiró (401), forzar refresh y reintentar una vez
  if (listRes.status === 401) {
    console.log("[Email scan] Token expirado, refrescando...");
    const token = await db.gmailToken.findUnique({ where: { userId } });
    if (!token) throw new Error("Gmail no conectado. Ve a /email/conectar");
    const refreshToken = decrypt(token.refreshToken);
    const refreshed = await refreshAccessToken(refreshToken);
    await db.gmailToken.update({
      where: { userId },
      data: {
        accessToken: encrypt(refreshed.access_token),
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
    accessToken = refreshed.access_token;
    listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    console.log("[Email scan] Retry status:", listRes.status);
  }

  if (!listRes.ok) {
    const errBody = await listRes.text().catch(() => "(no body)");
    console.error(`[Email scan] Gmail error HTTP ${listRes.status}:`, errBody);
    throw new Error(`Error fetching Gmail messages list: HTTP ${listRes.status} — ${errBody}`);
  }

  const listData = await listRes.json() as { messages?: { id: string }[] };
  const messages = listData.messages ?? [];

  let newPending = 0;
  let skippedExists = 0;
  let skippedNotBank = 0;
  let skippedNoParse = 0;

  for (const msg of messages) {
    // Verificar si ya fue procesado
    const existing = await db.emailTransaction.findUnique({
      where: { gmailMessageId: msg.id },
    });
    if (existing) { skippedExists++; continue; }

    // Obtener detalles del email — full incluye el body completo
    const msgRes = await fetch(`${GMAIL_API}/messages/${msg.id}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!msgRes.ok) { skippedNoParse++; continue; }

    const msgData = await msgRes.json() as GmailMessage;
    const headers = msgData.payload?.headers ?? [];
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
    const from = headers.find((h) => h.name === "From")?.value ?? "";
    const snippet = msgData.snippet ?? "";
    const bodyText = extractBodyText(msgData);
    const receivedAt = msgData.internalDate
      ? new Date(parseInt(msgData.internalDate))
      : new Date();

    if (!isBankEmail(from)) {
      skippedNotBank++;
      console.log(`[Email scan] Skipped (no bank match): from="${from}" subject="${subject.slice(0, 80)}"`);
      continue;
    }

    // Pasar body completo al parser. Si no hay body, usar snippet.
    const fullText = bodyText || snippet;
    const parsed = parseEmailTransaction(msg.id, subject, fullText, from, receivedAt);
    if (!parsed) {
      skippedNoParse++;
      console.log(`[Email scan] Skipped (no parse): from="${from}" subject="${subject.slice(0, 80)}" snippet="${snippet.slice(0, 100)}"`);
      continue;
    }

    // Guardar como EmailTransaction PENDING
    await db.emailTransaction.create({
      data: {
        userId,
        gmailMessageId: msg.id,
        status: "PENDING",
        rawSubject: parsed.rawSubject,
        rawSnippet: parsed.rawSnippet,
        parsedAmount: parsed.amount,
        parsedType: parsed.type,
        parsedDesc: parsed.description,
        parsedDate: parsed.date,
        parsedCurrency: parsed.currency,
        receivedAt: parsed.receivedAt,
      },
    });
    newPending++;
  }

  console.log(`[Email scan] Resultado: scanned=${messages.length} newPending=${newPending} skippedExists=${skippedExists} skippedNotBank=${skippedNotBank} skippedNoParse=${skippedNoParse}`);

  return {
    scanned: messages.length,
    newPending,
    skipped: skippedExists + skippedNotBank + skippedNoParse,
    skippedExists,
    skippedNotBank,
    skippedNoParse,
  };
}

// ─── Helper: extraer texto plano del body de un mensaje Gmail ─────────────────
function decodeBase64Url(data: string): string {
  // Gmail usa base64url (− y _ en lugar de + y /)
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(normalized, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBodyText(msgData: GmailMessage): string {
  const payload = msgData.payload;
  if (!payload) return "";

  // Caso 1: body directo en payload
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    return stripHtml(decoded).slice(0, 5000);
  }

  // Caso 2: multipart — preferir text/plain, fallback text/html
  const parts = payload.parts ?? [];
  let plainText = "";
  let htmlText = "";

  function walk(part: GmailMessagePart) {
    if (part.body?.data && part.mimeType) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === "text/plain" && !plainText) plainText = decoded;
      else if (part.mimeType === "text/html" && !htmlText) htmlText = decoded;
    }
    for (const sub of part.parts ?? []) walk(sub);
  }

  for (const part of parts) walk(part);

  if (plainText) return plainText.slice(0, 5000).replace(/\s+/g, " ").trim();
  if (htmlText) return stripHtml(htmlText).slice(0, 5000);
  return "";
}

// ─── Listar emails pendientes ─────────────────────────────────────────────────

export async function listPendingEmails(userId: string) {
  return db.emailTransaction.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { receivedAt: "desc" },
    take: 50,
  });
}
