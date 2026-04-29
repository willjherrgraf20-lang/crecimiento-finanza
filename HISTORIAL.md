# CrecimientoFinanza — Historial del Proyecto

## Contexto y Motivación

Reemplazo de **Banco_Odin** (proyecto anterior), que tenía dos problemas críticos:
1. Deploy en Railway/Render (free tier) — se dormía por inactividad
2. Funcionalidades incompletas (faltaba email parsing bancario, tracking ETF/crypto mejorado)

**Solución:** Nuevo proyecto desde cero con deploy en **Vercel + Supabase** (nunca duerme), diseño inspirado en Libertex (dark navy + verde/rojo PnL), y Gmail integration para parsear emails de bancos chilenos.

---

## Stack Técnico

| Tecnología | Uso |
|-----------|-----|
| Next.js 15 (App Router) | Framework fullstack |
| React 19 + TypeScript strict | Frontend |
| Tailwind CSS v4 | Estilos |
| Prisma 6 ORM | Acceso a base de datos |
| PostgreSQL en Supabase | Base de datos (free tier, us-east-1) |
| JWT httpOnly cookies | Autenticación |
| Recharts | Gráficos |
| Zod | Validación de esquemas |
| googleapis | Gmail API OAuth2 |
| Vercel | Deploy (serverless, sin sleep) |

---

## Lo Construido

### Fase 1 — Fundación

- **Estructura del proyecto**: Next.js 15 App Router, TypeScript strict, Tailwind v4
- **Sistema de autenticación**: JWT httpOnly cookies, bcrypt password hashing, middleware de protección de rutas
- **Diseño Libertex**: paleta dark navy (`#0d1117`) + verde ganancias (`#3fb950`) + rojo pérdidas (`#f85149`)
- **Layout**: Sidebar fijo (w-56) con iconos Lucide + Navbar con user menu
- **Componentes UI**: KpiCard, ChangeChip, Button, Input, DataTable, LoadingSpinner
- **Páginas auth**: `/auth/login`, `/auth/register`
- **APIs auth**: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`
- **vercel.json**: Cron job cada 3 días para mantener Supabase activo (`/api/cron/keep-alive`)

### Fase 2 — Core Financiero

- **Domain services**:
  - `expense.service.ts` — CRUD de gastos/ingresos
  - `account.service.ts` — CRUD de cuentas (CLP, USD, USDT)
  - `categorization.ts` — reglas de auto-categorización chilenas
  - `metrics.ts` — KPIs mensuales (ingresos, gastos, ahorro neto, tasa de ahorro)
- **APIs REST**: `/api/transacciones`, `/api/cuentas`, `/api/categorias`, `/api/presupuesto`, `/api/metas`, `/api/recurrentes`, `/api/reportes`
- **Páginas dashboard**:
  - `/dashboard` — KPIs del mes + cashflow area chart + pie de gastos + net worth
  - `/transacciones` — lista filtrable con búsqueda y nueva transacción
  - `/cuentas` — CRUD de cuentas con balances
  - `/categorias` — gestión de categorías personalizadas
  - `/presupuesto` — barras de progreso por categoría
  - `/metas` — metas de ahorro con progreso visual
  - `/recurrentes` — gastos/ingresos recurrentes
  - `/reportes` — histórico anual, cashflow, exportar CSV

### Fase 3 — Inversiones ETF + Cripto

- **Market data**: integración Binance API (cripto) + Yahoo Finance (ETF/acciones) en `lib/integrations/marketData.ts`
- **Domain services**: `portfolio.service.ts`, `holding.entity.ts`, `pricing.ts`
- **APIs**: `/api/inversiones/holdings`, `/api/inversiones/portafolio`, `/api/inversiones/trades`, `/api/sync-prices`
- **Páginas**:
  - `/inversiones` — portfolio overview con PnL total + AreaChart gradiente dinámico
  - `/inversiones/etf` — tabla de ETFs con precios live + posiciones + MiniSparkline
  - `/inversiones/cripto` — tabla de criptos con precios Binance + posiciones
- **Cron keep-alive**: `GET /api/cron/keep-alive` protegido con `CRON_SECRET`

### Fase 4 — Integración Gmail

- **Seguridad**: `src/lib/crypto.ts` — AES-256-GCM para encriptar tokens OAuth2 en BD
- **Gmail OAuth2 flow**:
  - `GET /api/email/auth` — genera URL de autorización con `access_type=offline`
  - `GET /api/email/callback` — intercambia code por tokens, encripta y guarda en `GmailToken`
  - `POST /api/email/scan` — lee emails de bancos chilenos, parsea y guarda `EmailTransaction`
  - `POST /api/email/confirm` — confirma transacción pendiente → crea `Expense`
- **Email parser** (`emailParser.service.ts`): regex para BancoChile, Falabella, Santander, Ripley, Tenpo, BancoEstado, Binance, BTG, BCI
- **Páginas**:
  - `/email` — bandeja de emails pendientes con `EmailPreviewCard` (editable antes de confirmar)
  - `/email/conectar` — página para conectar cuenta Gmail vía OAuth2

### Schema Prisma (15 modelos)

`User`, `Account`, `Category`, `Expense`, `Budget`, `SavingsGoal`, `Asset`, `Holding`, `InvestmentTransaction`, `AssetPrice`, `RecurringExpense`, `SyncJob`, `GmailToken`, `EmailTransaction`, `TelegramTransaction`

---

## Variables de Entorno (Producción)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Pooler Supabase (Transaction, puerto 6543) |
| `DIRECT_URL` | Conexión directa Supabase (puerto 5432, para migraciones) |
| `JWT_SECRET` | Secret para firmar tokens JWT |
| `ENCRYPTION_KEY` | 32 bytes hex para AES-256-GCM (tokens Gmail) |
| `CRON_SECRET` | Protege endpoint `/api/cron/keep-alive` |
| `GOOGLE_CLIENT_ID` | OAuth2 app de Google Cloud |
| `GOOGLE_CLIENT_SECRET` | OAuth2 secret |
| `GOOGLE_REDIRECT_URI` | `https://crecimiento-finanza.vercel.app/api/email/callback` |
| `TELEGRAM_BOT_TOKEN` | Token del bot @OFinanzaBot |
| `GEMINI_API_KEY` | API key de Google Gemini (vision OCR de comprobantes) |

---

## Infraestructura

- **Deploy**: Vercel (serverless, Washington D.C. — iad1)
- **Base de datos**: Supabase proyecto `CF-prod` — ID `jyirxozazduosegcyfhz`, región `us-east-1`
- **Pooler host**: `aws-1-us-east-1.pooler.supabase.com:6543` (Transaction pooler)
- **URL producción**: https://crecimiento-finanza.vercel.app

---

## Incidentes y Soluciones

### Error de DB en producción: `FATAL: Tenant or user not found`

**Síntoma**: Registro fallaba con error de servidor en `https://crecimiento-finanza.vercel.app/auth/register`

**Investigación** (proceso sistemático de eliminación):
1. ❌ URL encoding incorrecto — descartado (URL perfectamente formada)
2. ❌ Comillas extra en env vars — descartado (verificado con endpoint debug)
3. ❌ Conexión directa como alternativa — Supabase bloquea TCP externo en free tier
4. ❌ Puerto de pooler incorrecto — probado 6543 y 5432, mismo error
5. ❌ Problema específico de Vercel — reproducible también desde local
6. ❌ Problema de región (sa-east-1) — creado nuevo proyecto en us-east-1, mismo error

**Causa raíz**: El host del pooler era `aws-1-us-east-1.pooler.supabase.com`, pero asumimos `aws-0-...`. El número después de `aws-` no es siempre `0` — depende del cluster de Supabase asignado al proyecto.

**Fix**: Copiar el connection string directamente desde el dashboard de Supabase ("Connect your project" → "Transaction pooler").

**Lección aprendida**: Nunca construir el host del pooler de Supabase a mano. Siempre copiarlo desde el dashboard.

---

## Skills Instalados para Claude Code

- `supabase` — integración Supabase en proyectos
- `supabase-postgres-best-practices` — buenas prácticas Postgres con Supabase

---

## Estado Actual

- [x] Auth (register, login, logout) — funcionando en producción
- [x] Dashboard con KPIs y gráficos
- [x] CRUD transacciones, cuentas, categorías, presupuesto, metas, recurrentes
- [x] Inversiones ETF + cripto con precios live
- [x] Gmail integration (OAuth2 + parser bancos chilenos)
- [x] Deploy Vercel + Supabase estable
- [x] Bot Telegram (@OFinanzaBot) — procesa comprobantes con Gemini Vision
- [x] Google OAuth2 + Gmail API habilitados en Google Cloud Console
- [x] Webhook Telegram registrado en producción
- [x] Página de configuración (cambio de contraseña, gestionar Gmail conectado)
- [x] Extracción estructurada de comprobantes con metadata (RUT, cuentas, ID transacción) + idempotencia por `transaction_id`
- [x] Auto-asociación de vouchers a cuenta del usuario por `account_number`

---

## Fase 5 — Bot de Telegram

- **Bot**: @OFinanzaBot (`FinanzaOdin`) — Token configurado en `TELEGRAM_BOT_TOKEN`
- **IA**: Google Gemini 2.0 Flash (`GEMINI_API_KEY`) — vision OCR de comprobantes con `responseMimeType: application/json`
- **Flujo**: foto → Gemini OCR → TelegramTransaction PENDING → botones inline (cuenta → categoría → confirmar) → Expense creado
- **Archivos**:
  - `src/lib/telegram.ts` — helper Telegram Bot API (sendMessage, inline keyboards, descargar archivos)
  - `src/lib/gemini-vision.ts` — OCR estructurado: monto, tipo, fecha, RUT, cuentas, banco destino, ID transacción, confianza
  - `src/app/api/telegram/webhook/route.ts` — webhook principal con flujo multi-paso y auto-match de cuenta
  - `src/app/api/telegram/link/route.ts` — genera/revoca token de vinculación cuenta web ↔ Telegram
  - `src/app/api/telegram/setup/route.ts` — registra/elimina webhook en Telegram API
  - `src/app/api/telegram/transactions/route.ts` — historial de TelegramTransactions del usuario
  - `src/app/(dashboard)/telegram/page.tsx` — página de vinculación e historial en el dashboard
- **Modelo Prisma `TelegramTransaction`** + campos `telegramChatId`, `telegramLinkToken` en `User`

---

## Fase 6 — Extracción estructurada y configuración

### Metadata estructurada de comprobantes

- Prompt de Gemini reescrito a JSON anidado con 16 campos: `monto`, `descripcion`, `fecha_movimiento`, `nombre_origen/destinatario`, `rut_origen/destinatario`, `cuenta_origen/abono`, `banco_destino`, `id_transaccion`, `fecha_hora_comprobante`, `confianza`
- Reglas explícitas para variantes de bancos chilenos (BCI: "Pagado a"/"Cuenta destino"; Banco de Chile: "Traspaso a/de"/"Movimiento Exitoso"; etc.)
- Regla crítica: **NUNCA inventar datos** — campos no detectados quedan `null`/`""`. La fecha y descripción ya no se completan con plantillas
- Migraciones Prisma:
  - `expenses` + `telegram_transactions`: `transaction_id`, `counterparty_name/rut/account/bank`, `owner_account`
  - Índice unique `(user_id, transaction_id)` en `expenses` para idempotencia
  - `accounts.account_number` para auto-asociación

### Idempotencia

- Antes de crear PENDING, el bot verifica `Expense` con mismo `(userId, transactionId)` → avisa "Ya fue registrado el [fecha]"
- También verifica `TelegramTransaction` PENDING en curso → "Ya estás procesando este comprobante"

### Auto-asociación de cuenta

- Si el voucher trae `cuenta_origen` (EXPENSE) o `cuenta_abono` (INCOME) que matchea con el `accountNumber` de alguna cuenta del usuario, el bot **salta la pregunta de cuenta** y va directo a categoría
- Match tolerante a ceros a la izquierda (`001696993900` ≡ `1696993900`)

### Pantalla de revisión cuando faltan datos

- `getMissingFields()` evalúa según `documentType` + `type` qué campos esperar
- Si falta cualquiera, el bot muestra:
  - Lo que sí pudo leer (con "*no detectado*" en cursiva en lo que falta)
  - Lista explícita "No detecté: ..."
  - Botones: "Continuar de todos modos" / "Cancelar y reenviar foto"
- Si **falta el monto** (campo crítico), solo se ofrece reenviar — sin monto no se puede crear el `Expense`

### Página de configuración (`/configuracion`)

- Cambio de contraseña: valida la actual con bcrypt, exige mín. 8 caracteres y que sea distinta
- Gestión de Gmail: muestra el email asociado (consultando `users.getProfile`), botón "Desvincular" (borra `GmailToken`), botón "Conectar otra cuenta" (el callback hace upsert)

### Email scanner mejorado

- `format=full` en lugar de `format=metadata` → parser ve el body completo en lugar del snippet de ~100 chars
- `extractBodyText()`: walker recursivo de partes MIME, prefiere `text/plain`, fallback `text/html` con strip de tags
- Diagnóstico desglosado en la respuesta: `skippedExists`, `skippedNotBank`, `skippedNoParse`
- Khipu agregado a `BANK_SENDERS` y `GMAIL_QUERY` (matching parcial cubre `serviciostransferencias@bancochile.cl`)
- Query Gmail con formato `after:YYYY/MM/DD` (antes timestamp Unix → 400 Bad Request)

### Limpieza

- Eliminado `src/lib/finance/budgeting.ts` (código muerto, sin imports)

