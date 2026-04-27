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

- **Domain services** (copiados y adaptados de Banco_Odin):
  - `expense.service.ts` — CRUD de gastos/ingresos
  - `account.service.ts` — CRUD de cuentas (CLP, USD, USDT)
  - `categorization.ts` — reglas de auto-categorización chilenas
  - `metrics.ts` — KPIs mensuales (ingresos, gastos, ahorro neto, tasa de ahorro)
  - `budgeting.ts` — presupuestos y progreso por categoría
  - `reports.service.ts` — reportes históricos y exportación CSV
  - `sync.service.ts` — sincronización de datos
- **APIs REST**: `/api/transacciones`, `/api/cuentas`, `/api/categorias`, `/api/presupuesto`, `/api/metas`, `/api/recurrentes`
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

- **Market data**: integración Binance API (cripto) + Yahoo Finance (ETF/acciones)
- **Domain services**: `portfolio.service.ts`, `investments.service.ts`, `pricing.ts`
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

### Schema Prisma (14 modelos)

`User`, `Account`, `Transaction`, `Category`, `Budget`, `Goal`, `RecurringTransaction`, `Investment`, `InvestmentTrade`, `PriceCache`, `BankImport`, `GmailToken`, `EmailTransaction`, `SyncLog`

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
- [ ] Configurar Google OAuth2 en Google Cloud Console (pendiente — necesita credenciales reales para activar `/email`)
- [ ] Configurar webhook Telegram en producción (POST /api/telegram/setup con URL de Vercel)

---

## Fase 5 — Bot de Telegram

- **Bot**: @OFinanzaBot (`FinanzaOdin`) — Token configurado en `TELEGRAM_BOT_TOKEN`
- **IA**: Gemini 1.5 Flash (`GEMINI_API_KEY`) — extrae monto, tipo, descripción y fecha del comprobante
- **Flujo**: foto → Gemini OCR → TelegramTransaction PENDING → botones inline (cuenta → categoría → confirmar) → Expense creado
- **Nuevos archivos**:
  - `src/lib/telegram.ts` — helper Telegram Bot API (sendMessage, inline keyboards, descargar archivos)
  - `src/lib/gemini-vision.ts` — OCR de comprobantes bancarios con Gemini 1.5 Flash
  - `src/app/api/telegram/webhook/route.ts` — webhook principal del bot (flujo completo multi-paso)
  - `src/app/api/telegram/link/route.ts` — genera/revoca token de vinculación cuenta web ↔ Telegram
  - `src/app/api/telegram/setup/route.ts` — registra/elimina webhook en Telegram API
  - `src/app/api/telegram/transactions/route.ts` — historial de TelegramTransactions del usuario
  - `src/app/(dashboard)/telegram/page.tsx` — página de vinculación e historial en el dashboard
- **Nuevos modelos Prisma**: `TelegramTransaction` + campos `telegramChatId`, `telegramLinkToken` en `User`
- **Variables de entorno**: `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`
- **Para activar en producción**: `POST /api/telegram/setup` con `{ webhookUrl: "https://crecimiento-finanza.vercel.app" }` (Authorization: Bearer CRON_SECRET)

