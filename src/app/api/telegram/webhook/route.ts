import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  sendMessage,
  sendInlineKeyboard,
  answerCallbackQuery,
  editMessageText,
  downloadFileAsBase64,
  type TelegramUpdate,
  type InlineKeyboardButton,
} from "@/lib/telegram";
import { extractTransactionFromImage, type ExtractedTransaction } from "@/lib/gemini-vision";
import { createExpense } from "@/domain/expenses/expense.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number, currency: string): string {
  if (currency === "CLP") {
    return `$${amount.toLocaleString("es-CL")} CLP`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

function typeLabel(type: string): string {
  switch (type) {
    case "EXPENSE": return "💸 Gasto";
    case "INCOME": return "💰 Ingreso";
    case "TRANSFER": return "🔄 Transferencia";
    default: return type;
  }
}

/**
 * Devuelve la lista de campos que el usuario espera y NO se detectaron.
 * El nombre del campo cambia según la dirección del movimiento.
 */
function getMissingFields(extracted: ExtractedTransaction): string[] {
  const missing: string[] = [];

  // Monto — crítico, sin él no se puede registrar el movimiento
  if (!extracted.amount || extracted.amount <= 0) missing.push("Monto");

  // Tipo de documento — siempre debería existir (default voucher)
  if (!extracted.documentType) missing.push("Tipo de documento");

  // Descripción — esperada en todos los documentos
  if (!extracted.description || extracted.description.trim().length < 3) {
    missing.push("Descripción");
  }

  // Para vouchers (transferencias), pedir info de la contraparte e ID
  if (extracted.documentType === "voucher") {
    const isIncome = extracted.type === "INCOME";
    if (!extracted.counterpartyName) missing.push(isIncome ? "Nombre origen" : "Nombre destinatario");
    if (!extracted.counterpartyRut) missing.push(isIncome ? "RUT origen" : "RUT destinatario");
    if (!extracted.counterpartyAccount) missing.push(isIncome ? "Cuenta origen" : "Cuenta abono");
    if (!extracted.transactionId) missing.push("ID de transacción");
  }

  // Para statements (pago tarjeta) — solo ID es esperado
  if (extracted.documentType === "statement") {
    if (!extracted.transactionId) missing.push("ID de transacción");
  }

  return missing;
}

/**
 * Normaliza un número de cuenta (quita ceros a la izquierda y caracteres no numéricos)
 * para comparar tolerantemente "0000000001696993900" con "1696993900".
 */
function normalizeAccountNumber(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/\D/g, "").replace(/^0+/, "");
}

/**
 * Busca una cuenta del usuario que matchee el número detectado en el comprobante.
 */
async function findMatchingAccount(userId: string, ownerAccount: string | null | undefined) {
  if (!ownerAccount) return null;
  const target = normalizeAccountNumber(ownerAccount);
  if (!target) return null;

  const accounts = await db.account.findMany({ where: { userId } });
  return accounts.find((acc) => normalizeAccountNumber(acc.accountNumber) === target) ?? null;
}

/**
 * Muestra los botones de selección de cuenta. Se usa tanto desde el flujo
 * "extracción limpia" como desde el callback "proceed" (continuar pese a faltantes).
 */
async function askForAccount(
  chatId: number,
  userId: string,
  txId: string,
  preface: string
): Promise<void> {
  const accounts = await db.account.findMany({
    where: { userId },
    take: 5,
    orderBy: { createdAt: "asc" },
  });

  if (accounts.length === 0) {
    await sendMessage(chatId, "⚠️ No tienes cuentas registradas. Crea una cuenta primero en la aplicación.");
    return;
  }

  const accountButtons: InlineKeyboardButton[][] = accounts.map((acc) => [
    {
      text: `${acc.name} (${acc.currency})`,
      callback_data: `acct:${txId}:${acc.id}`,
    },
  ]);

  await sendInlineKeyboard(chatId, preface, accountButtons);
}

/**
 * Muestra los botones para elegir categoría dado un txId + accountId ya resueltos.
 */
async function askForCategory(
  chatId: number,
  userId: string,
  txId: string,
  accountId: string,
  preface: string
): Promise<void> {
  const categories = await db.category.findMany({
    where: { OR: [{ userId }, { isSystem: true }] },
    take: 8,
    orderBy: { name: "asc" },
  });

  const catButtons: InlineKeyboardButton[][] = categories.map((cat) => [
    { text: `${cat.icon ?? "📌"} ${cat.name}`, callback_data: `cat:${txId}:${accountId}:${cat.id}` },
  ]);
  catButtons.push([{ text: "⏭️ Sin categoría", callback_data: `cat:${txId}:${accountId}:none` }]);

  await sendInlineKeyboard(chatId, preface, catButtons);
}

// ─── Procesamiento de imágenes/fotos ─────────────────────────────────────────

async function handlePhoto(
  chatId: number,
  userId: string,
  fileId: string,
  caption?: string
): Promise<void> {
  await sendMessage(chatId, "⏳ <b>Procesando el documento...</b> Dame un momento.");

  console.log(`[Webhook] handlePhoto iniciado. chatId=${chatId} userId=${userId} fileId=${fileId}`);

  const imageData = await downloadFileAsBase64(fileId);
  if (!imageData) {
    console.error(`[Webhook] downloadFileAsBase64 falló para fileId=${fileId}`);
    await sendMessage(chatId, "❌ No pude descargar la imagen. Intenta nuevamente.");
    return;
  }

  console.log(`[Webhook] Imagen descargada. mimeType=${imageData.mimeType} base64Length=${imageData.base64.length}`);

  const extracted = await extractTransactionFromImage(imageData.base64, imageData.mimeType);

  console.log(`[Webhook] extractTransactionFromImage resultado:`, JSON.stringify(extracted));

  if (!extracted) {
    await sendMessage(
      chatId,
      "❌ <b>No pude reconocer un documento financiero válido en la imagen.</b>\n\n" +
      "Puedes enviar:\n• Foto de un comprobante de transferencia\n• Estado de cuenta de tarjeta de crédito"
    );
    return;
  }

  // Idempotencia: si ya existe un Expense con el mismo transactionId, avisar y no duplicar
  if (extracted.transactionId) {
    const existing = await db.expense.findUnique({
      where: { user_transaction_unique: { userId, transactionId: extracted.transactionId } },
    });
    if (existing) {
      await sendMessage(
        chatId,
        `ℹ️ <b>Este comprobante ya fue registrado.</b>\n\n` +
        `ID transacción: <code>${extracted.transactionId}</code>\n` +
        `Registrado el: ${existing.date.toLocaleDateString("es-CL")}\n\n` +
        `No se duplica.`
      );
      return;
    }
  }

  // Guardar TelegramTransaction como PENDING
  const telegramTx = await db.telegramTransaction.create({
    data: {
      userId,
      telegramFileId: fileId,
      parsedAmount: extracted.amount,
      parsedType: extracted.type,
      parsedDesc: extracted.description,
      parsedDate: extracted.date,
      parsedCurrency: extracted.currency,
      rawCaption: caption ?? null,
      transactionId: extracted.transactionId ?? null,
      counterpartyName: extracted.counterpartyName ?? null,
      counterpartyRut: extracted.counterpartyRut ?? null,
      counterpartyAccount: extracted.counterpartyAccount ?? null,
      counterpartyBank: extracted.counterpartyBank ?? null,
      ownerAccount: extracted.ownerAccount ?? null,
    },
  });

  const docLabel = extracted.documentType === "statement"
    ? "Estado de cuenta detectado"
    : extracted.documentType === "receipt"
    ? "Boleta/Factura detectada"
    : "Comprobante detectado";

  const dateLabel = extracted.documentType === "statement" ? "Vencimiento" : "Fecha";

  const counterpartyLine = extracted.counterpartyName
    ? `👤 <b>${extracted.type === "INCOME" ? "Origen" : "Destino"}:</b> ${extracted.counterpartyName}` +
      (extracted.counterpartyRut ? ` (${extracted.counterpartyRut})` : "")
    : "";
  const accountLine = extracted.counterpartyAccount
    ? `💳 <b>${extracted.type === "INCOME" ? "Cuenta origen" : "Cuenta abono"}:</b> <code>${extracted.counterpartyAccount}</code>`
    : "";
  const bankLine = extracted.counterpartyBank ? `🏦 <b>Banco:</b> ${extracted.counterpartyBank}` : "";
  const txIdLine = extracted.transactionId ? `🔖 <b>ID:</b> <code>${extracted.transactionId}</code>` : "";

  const amountStr = extracted.amount > 0
    ? formatAmount(extracted.amount, extracted.currency)
    : "<i>no detectado</i>";
  const descStr = extracted.description?.trim() ? extracted.description : "<i>no detectado</i>";

  const dataLines =
    `📊 <b>Tipo:</b> ${typeLabel(extracted.type)}\n` +
    `💵 <b>Monto:</b> ${amountStr}\n` +
    `📝 <b>Descripción:</b> ${descStr}\n` +
    [counterpartyLine, accountLine, bankLine, txIdLine].filter(Boolean).map((l) => l + "\n").join("") +
    `📅 <b>${dateLabel}:</b> ${extracted.date.toLocaleDateString("es-CL")}\n` +
    `🎯 <b>Confianza:</b> ${extracted.confidence}`;

  // Verificar campos faltantes / confianza baja
  const missing = getMissingFields(extracted);
  const lowConfidence = extracted.confidence === "low";
  const hasAmount = extracted.amount > 0;

  if (missing.length > 0 || lowConfidence) {
    const cantContinue = !hasAmount;

    const reviewText =
      `⚠️ <b>${docLabel} — datos incompletos</b>\n\n` +
      `Lo que pude leer:\n${dataLines}\n\n` +
      (missing.length > 0
        ? `<b>No detecté:</b>\n${missing.map((m) => `• ${m}`).join("\n")}\n\n`
        : "") +
      (lowConfidence
        ? `🔍 La lectura tiene confianza baja — la imagen puede estar borrosa o cortada.\n\n`
        : "") +
      (cantContinue
        ? `❌ <b>Sin monto no puedo registrar el movimiento.</b>\n` +
          `Reenvía una foto donde se vea claramente el monto.\n\n`
        : `¿Qué quieres hacer?`);

    const buttons: InlineKeyboardButton[][] = cantContinue
      ? [[{ text: "🔁 Reenviar foto", callback_data: `discard:${telegramTx.id}` }]]
      : [
          [{ text: "✅ Continuar de todos modos", callback_data: `proceed:${telegramTx.id}` }],
          [{ text: "🔁 Cancelar y reenviar foto", callback_data: `discard:${telegramTx.id}` }],
        ];

    await sendInlineKeyboard(chatId, reviewText, buttons);
    return;
  }

  // Extracción limpia → intentar auto-asociar la cuenta por número
  const matched = await findMatchingAccount(userId, extracted.ownerAccount);

  if (matched) {
    await askForCategory(
      chatId,
      userId,
      telegramTx.id,
      matched.id,
      `✅ <b>${docLabel}</b>\n\n${dataLines}\n\n` +
      `🎯 Cuenta auto-asociada: <b>${matched.name}</b> (N° ${matched.accountNumber})\n\n` +
      `¿Qué categoría?`
    );
    return;
  }

  // Sin match → preguntar cuenta como siempre
  await askForAccount(
    chatId,
    userId,
    telegramTx.id,
    `✅ <b>${docLabel}</b>\n\n${dataLines}\n\n¿Desde qué cuenta?`
  );
}

// ─── Procesamiento de callbacks (botones inline) ──────────────────────────────

async function handleCallback(
  queryId: string,
  chatId: number,
  messageId: number,
  userId: string,
  data: string
): Promise<void> {
  const parts = data.split(":");

  // ── Paso 0a: usuario quiere continuar pese a faltantes → auto-match o preguntar cuenta ──
  if (parts[0] === "proceed") {
    const [, txId] = parts;
    const tx = await db.telegramTransaction.findUnique({ where: { id: txId, userId } });
    if (!tx || tx.status !== "PENDING") {
      await answerCallbackQuery(queryId, "Esta transacción ya fue procesada.");
      return;
    }
    await answerCallbackQuery(queryId, "Continuando…");
    await editMessageText(chatId, messageId, `✅ Continuando con los datos detectados.`);

    const matched = await findMatchingAccount(userId, tx.ownerAccount);
    if (matched) {
      await askForCategory(
        chatId,
        userId,
        txId,
        matched.id,
        `🎯 Cuenta auto-asociada: <b>${matched.name}</b> (N° ${matched.accountNumber})\n\n¿Qué categoría?`
      );
      return;
    }
    await askForAccount(chatId, userId, txId, "Selecciona la cuenta:");
    return;
  }

  // ── Paso 0b: usuario descarta y quiere reenviar foto ──
  if (parts[0] === "discard") {
    const [, txId] = parts;
    await db.telegramTransaction.updateMany({
      where: { id: txId, userId, status: "PENDING" },
      data: { status: "REJECTED" },
    });
    await answerCallbackQuery(queryId, "Cancelado");
    await editMessageText(
      chatId,
      messageId,
      `🔁 <b>Comprobante descartado.</b>\n\n` +
      `Vuelve a enviar la foto, asegurándote de que se vean claramente:\n` +
      `• Monto\n• Nombre y RUT de la contraparte\n• Cuenta de abono u origen\n• ID de transacción`
    );
    return;
  }

  // ── Paso 1: eligió cuenta → preguntar categoría ──
  if (parts[0] === "acct") {
    const [, txId, accountId] = parts;

    await db.telegramTransaction.update({
      where: { id: txId },
      data: { expenseId: null }, // reset
    });

    // Obtener categorías del usuario
    const categories = await db.category.findMany({
      where: { OR: [{ userId }, { isSystem: true }] },
      take: 8,
      orderBy: { name: "asc" },
    });

    const catButtons: InlineKeyboardButton[][] = categories.map((cat) => [
      { text: `${cat.icon ?? "📌"} ${cat.name}`, callback_data: `cat:${txId}:${accountId}:${cat.id}` },
    ]);
    catButtons.push([{ text: "⏭️ Sin categoría", callback_data: `cat:${txId}:${accountId}:none` }]);

    await answerCallbackQuery(queryId, "Cuenta seleccionada ✓");
    await editMessageText(chatId, messageId, "¿Qué categoría de gasto es?", catButtons);
    return;
  }

  // ── Paso 2: eligió categoría → mostrar confirmación ──
  if (parts[0] === "cat") {
    const [, txId, accountId, categoryId] = parts;

    const tx = await db.telegramTransaction.findUnique({ where: { id: txId } });
    if (!tx) {
      await answerCallbackQuery(queryId, "Error: transacción no encontrada");
      return;
    }

    const account = await db.account.findUnique({ where: { id: accountId } });
    const category = categoryId !== "none"
      ? await db.category.findUnique({ where: { id: categoryId } })
      : null;

    const confirmText =
      `📋 <b>Confirmar registro</b>\n\n` +
      `${typeLabel(tx.parsedType ?? "EXPENSE")} de <b>${formatAmount(Number(tx.parsedAmount), tx.parsedCurrency ?? "CLP")}</b>\n` +
      `📝 ${tx.parsedDesc}\n` +
      `🏦 Cuenta: ${account?.name ?? "—"}\n` +
      `📂 Categoría: ${category ? `${category.icon ?? ""} ${category.name}` : "Sin categoría"}\n` +
      `📅 ${tx.parsedDate?.toLocaleDateString("es-CL") ?? "Hoy"}\n\n` +
      `¿Guardar este movimiento?`;

    const confirmButtons: InlineKeyboardButton[][] = [
      [
        { text: "✅ Sí, guardar", callback_data: `confirm:${txId}:${accountId}:${categoryId}` },
        { text: "❌ Cancelar", callback_data: `cancel:${txId}` },
      ],
    ];

    await answerCallbackQuery(queryId, "Categoría seleccionada ✓");
    await editMessageText(chatId, messageId, confirmText, confirmButtons);
    return;
  }

  // ── Paso 3: confirmación final → crear Expense ──
  if (parts[0] === "confirm") {
    const [, txId, accountId, categoryId] = parts;

    const tx = await db.telegramTransaction.findUnique({ where: { id: txId, userId } });
    if (!tx || tx.status !== "PENDING") {
      await answerCallbackQuery(queryId, "Esta transacción ya fue procesada.");
      return;
    }

    const expense = await createExpense({
      userId,
      accountId,
      categoryId: categoryId !== "none" ? categoryId : null,
      amount: Number(tx.parsedAmount),
      type: (tx.parsedType ?? "EXPENSE") as "EXPENSE" | "INCOME" | "TRANSFER",
      description: tx.parsedDesc,
      date: tx.parsedDate ?? new Date(),
      currency: tx.parsedCurrency ?? "CLP",
      transactionId: tx.transactionId,
      counterpartyName: tx.counterpartyName,
      counterpartyRut: tx.counterpartyRut,
      counterpartyAccount: tx.counterpartyAccount,
      counterpartyBank: tx.counterpartyBank,
    });

    await db.telegramTransaction.update({
      where: { id: txId },
      data: { status: "CONFIRMED", expenseId: expense.id },
    });

    await answerCallbackQuery(queryId, "¡Guardado! ✅");
    await editMessageText(
      chatId,
      messageId,
      `✅ <b>¡Movimiento registrado!</b>\n\n` +
      `${typeLabel(tx.parsedType ?? "EXPENSE")} de <b>${formatAmount(Number(tx.parsedAmount), tx.parsedCurrency ?? "CLP")}</b>\n` +
      `📝 ${tx.parsedDesc}\n\n` +
      `Lo puedes ver en el dashboard de <b>CrecimientoFinanza</b> 📊`
    );
    return;
  }

  // ── Cancelar ──
  if (parts[0] === "cancel") {
    const [, txId] = parts;
    await db.telegramTransaction.update({
      where: { id: txId },
      data: { status: "REJECTED" },
    });
    await answerCallbackQuery(queryId, "Cancelado");
    await editMessageText(chatId, messageId, "❌ <b>Registro cancelado.</b>\n\nPuedes enviar otro comprobante cuando quieras.");
    return;
  }

  await answerCallbackQuery(queryId);
}

// ─── Webhook principal ────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const update: TelegramUpdate = await req.json();

    // ── Callback query (botones inline) ──
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id;
      const messageId = cq.message?.message_id;
      const telegramChatId = String(cq.from.id);

      if (!chatId || !messageId) return NextResponse.json({ ok: true });

      const user = await db.user.findUnique({ where: { telegramChatId } });
      if (!user) {
        await answerCallbackQuery(cq.id, "⚠️ Tu cuenta no está vinculada");
        return NextResponse.json({ ok: true });
      }

      await handleCallback(cq.id, chatId, messageId, user.id, cq.data ?? "");
      return NextResponse.json({ ok: true });
    }

    // ── Mensajes normales ──
    const msg = update.message;
    if (!msg) return NextResponse.json({ ok: true });

    const chatId = msg.chat.id;
    const telegramChatId = String(msg.from?.id ?? chatId);
    const text = msg.text?.trim() ?? "";

    // ── Comando /start con token de vinculación ──
    if (text.startsWith("/start")) {
      const token = text.split(" ")[1];
      if (token) {
        const user = await db.user.findUnique({ where: { telegramLinkToken: token } });
        if (!user) {
          await sendMessage(chatId, "❌ Token de vinculación inválido o expirado.\n\nVe al dashboard y genera un nuevo enlace.");
          return NextResponse.json({ ok: true });
        }

        await db.user.update({
          where: { id: user.id },
          data: { telegramChatId, telegramLinkToken: null },
        });

        await sendMessage(
          chatId,
          `🎉 <b>¡Cuenta vinculada exitosamente!</b>\n\n` +
          `Hola <b>${user.name ?? user.email}</b>, ya puedes enviarme fotos de tus comprobantes de transferencia.\n\n` +
          `📸 Simplemente envía una foto y yo la procesaré automáticamente.`
        );
        return NextResponse.json({ ok: true });
      }

      // /start sin token
      const user = await db.user.findUnique({ where: { telegramChatId } });
      if (user) {
        await sendMessage(
          chatId,
          `👋 <b>¡Hola ${user.name ?? user.email}!</b>\n\n` +
          `Tu cuenta ya está vinculada ✅\n\nEnvíame una foto de cualquier comprobante de transferencia y lo registro por ti.`
        );
      } else {
        await sendMessage(
          chatId,
          `👋 <b>Hola!</b> Soy el bot de <b>CrecimientoFinanza</b>.\n\n` +
          `Para empezar, ve al dashboard y vincula tu cuenta de Telegram:\n` +
          `🌐 https://crecimiento-finanza.vercel.app/telegram`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── Verificar que el usuario está vinculado para el resto de mensajes ──
    const user = await db.user.findUnique({ where: { telegramChatId } });
    if (!user) {
      await sendMessage(
        chatId,
        `⚠️ Tu cuenta de Telegram no está vinculada.\n\n` +
        `Ve al dashboard y genera tu enlace de vinculación:\n` +
        `🌐 https://crecimiento-finanza.vercel.app/telegram`
      );
      return NextResponse.json({ ok: true });
    }

    // ── Foto enviada ──
    if (msg.photo && msg.photo.length > 0) {
      // Tomar la foto de mayor resolución (última del array)
      const bestPhoto = msg.photo[msg.photo.length - 1];
      await handlePhoto(chatId, user.id, bestPhoto.file_id, msg.caption);
      return NextResponse.json({ ok: true });
    }

    // ── Documento enviado (PDF o imagen como archivo) ──
    if (msg.document) {
      const mimeType = msg.document.mime_type ?? "";
      if (mimeType.startsWith("image/")) {
        await handlePhoto(chatId, user.id, msg.document.file_id, msg.caption);
      } else {
        await sendMessage(
          chatId,
          "📎 Por ahora solo proceso imágenes de comprobantes.\n\nEnvía una <b>foto</b> del comprobante (no como archivo adjunto)."
        );
      }
      return NextResponse.json({ ok: true });
    }

    // ── Ayuda general ──
    if (text === "/help" || text === "/ayuda") {
      await sendMessage(
        chatId,
        `ℹ️ <b>Cómo usar este bot:</b>\n\n` +
        `1️⃣ Envía una foto de un comprobante de transferencia\n` +
        `2️⃣ Confirma los datos detectados\n` +
        `3️⃣ Selecciona cuenta y categoría\n` +
        `4️⃣ El movimiento se registra en CrecimientoFinanza\n\n` +
        `📱 Ver dashboard: https://crecimiento-finanza.vercel.app`
      );
      return NextResponse.json({ ok: true });
    }

    // ── Mensaje de texto genérico ──
    await sendMessage(
      chatId,
      `📸 Envíame una <b>foto de un comprobante</b> de transferencia y lo registro automáticamente.\n\nEscribe /ayuda si necesitas más info.`
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
    // Siempre responder 200 a Telegram para evitar reintentos
    return NextResponse.json({ ok: true });
  }
}
