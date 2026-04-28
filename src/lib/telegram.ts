const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// ─── Tipos básicos de Telegram ────────────────────────────────────────────────

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  caption?: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

// ─── Funciones de envío ───────────────────────────────────────────────────────

export async function sendMessage(
  chatId: number,
  text: string,
  options: Record<string, unknown> = {}
): Promise<void> {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...options }),
  });
}

export async function sendInlineKeyboard(
  chatId: number,
  text: string,
  buttons: InlineKeyboardButton[][]
): Promise<void> {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons },
    }),
  });
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  buttons?: InlineKeyboardButton[][]
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };
  if (buttons) {
    body.reply_markup = { inline_keyboard: buttons };
  }
  await fetch(`${TELEGRAM_API}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function answerCallbackQuery(
  queryId: string,
  text?: string
): Promise<void> {
  await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: queryId, text }),
  });
}

// ─── Descarga de archivos ─────────────────────────────────────────────────────

export async function getFileUrl(fileId: string): Promise<string | null> {
  const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  const data = await res.json() as { ok: boolean; result?: { file_path?: string } };
  if (!data.ok || !data.result?.file_path) return null;
  return `${TELEGRAM_FILE_API}/${data.result.file_path}`;
}

export async function downloadFileAsBase64(fileId: string): Promise<{ base64: string; mimeType: string } | null> {
  const url = await getFileUrl(fileId);
  if (!url) return null;

  const res = await fetch(url);
  if (!res.ok) return null;

  const rawContentType = res.headers.get("content-type") ?? "image/jpeg";
  const mimeType = rawContentType.split(";")[0].trim();
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  return { base64, mimeType };
}

// ─── Configurar webhook ───────────────────────────────────────────────────────

export async function setWebhook(webhookUrl: string): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  const data = await res.json() as { ok: boolean };
  return data.ok;
}

export async function deleteWebhook(): Promise<boolean> {
  const res = await fetch(`${TELEGRAM_API}/deleteWebhook`, { method: "POST" });
  const data = await res.json() as { ok: boolean };
  return data.ok;
}
