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
import { extractTransactionFromImage } from "@/lib/gemini-vision";
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
    },
  });

  // Obtener cuentas del usuario para mostrar botones
  const accounts = await db.account.findMany({
    where: { userId },
    take: 5,
    orderBy: { createdAt: "asc" },
  });

  if (accounts.length === 0) {
    await sendMessage(
      chatId,
      "⚠️ No tienes cuentas registradas. Crea una cuenta primero en la aplicación."
    );
    return;
  }

  const docLabel = extracted.documentType === "statement"
    ? "Estado de cuenta detectado"
    : "Comprobante detectado";

  const dateLabel = extracted.documentType === "statement" ? "Vencimiento" : "Fecha";

  const summary =
    `✅ <b>${docLabel}</b>\n\n` +
    `📊 <b>Tipo:</b> ${typeLabel(extracted.type)}\n` +
    `💵 <b>Monto:</b> ${formatAmount(extracted.amount, extracted.currency)}\n` +
    `📝 <b>Descripción:</b> ${extracted.description}\n` +
    `📅 <b>${dateLabel}:</b> ${extracted.date.toLocaleDateString("es-CL")}\n` +
    `🎯 <b>Confianza:</b> ${extracted.confidence}\n\n` +
    `¿Desde qué cuenta?`;

  const accountButtons: InlineKeyboardButton[][] = accounts.map((acc) => [
    {
      text: `${acc.name} (${acc.currency})`,
      callback_data: `acct:${telegramTx.id}:${acc.id}`,
    },
  ]);

  await sendInlineKeyboard(chatId, summary, accountButtons);
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
