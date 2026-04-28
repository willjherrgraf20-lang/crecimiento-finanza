import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { parseEmailTransaction, isBankEmail, GMAIL_QUERY } from "./emailParser.service";
import type { GmailMessage } from "./email.types";

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

export async function scanBankEmails(userId: string): Promise<{ scanned: number; newPending: number; skipped: number }> {
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
  let skipped = 0;

  for (const msg of messages) {
    // Verificar si ya fue procesado
    const existing = await db.emailTransaction.findUnique({
      where: { gmailMessageId: msg.id },
    });
    if (existing) { skipped++; continue; }

    // Obtener detalles del email
    const msgRes = await fetch(`${GMAIL_API}/messages/${msg.id}?format=metadata&metadataHeaders=Subject,From,Date`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!msgRes.ok) { skipped++; continue; }

    const msgData = await msgRes.json() as GmailMessage;
    const headers = msgData.payload?.headers ?? [];
    const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
    const from = headers.find((h) => h.name === "From")?.value ?? "";
    const snippet = msgData.snippet ?? "";
    const receivedAt = msgData.internalDate
      ? new Date(parseInt(msgData.internalDate))
      : new Date();

    if (!isBankEmail(from)) { skipped++; continue; }

    const parsed = parseEmailTransaction(msg.id, subject, snippet, from, receivedAt);
    if (!parsed) { skipped++; continue; }

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

  return { scanned: messages.length, newPending, skipped };
}

// ─── Listar emails pendientes ─────────────────────────────────────────────────

export async function listPendingEmails(userId: string) {
  return db.emailTransaction.findMany({
    where: { userId, status: "PENDING" },
    orderBy: { receivedAt: "desc" },
    take: 50,
  });
}
