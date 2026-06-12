# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Trackt: plataforma de gestión de mantenimiento industrial (equipos → órdenes de trabajo → tickets, con evidencias, inventario de repuestos y notificaciones). Monorepo con dos productos:

- `producto/trackt-api` — API REST en NestJS 11 + Prisma + Supabase (PostgreSQL/Auth/Storage).
- `producto/tract-front` — frontend Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui + React Query. Ojo: la carpeta se llama `tract-front` (sin la "k"), no es un typo a corregir.

## Comandos

### Backend (`producto/trackt-api`)

```bash
npm run start:dev        # dev con watch (usar PORT=3001 para no chocar con Next)
npm run build            # prisma generate + nest build
npm run test             # todos los tests (Jest, *.spec.ts bajo src/)
npx jest src/tickets/tickets.service.spec.ts   # un solo archivo de test
npx jest -t "nombre del test"                  # un test por nombre
npm run lint             # eslint con --fix
npm run db:seed          # seed demo (tenant + admin + 4 mecánicos + datos)
npx prisma generate      # regenerar cliente tras cambiar schema.prisma
```

### Frontend (`producto/tract-front`)

```bash
npm run dev              # localhost:3000
npm run build
npm run lint
```

Validación antes de PR: backend `npm run build && npm run test`; frontend `npm run lint && npm run build`.

## Arquitectura

```
tract-front (Next.js, Vercel) → trackt-api (NestJS, Railway) → Supabase (PostgreSQL / Auth / Storage)
```

### Datos y migraciones

- Modelado en `producto/trackt-api/prisma/schema.prisma` (convenciones documentadas en su cabecera: PKs `cuid()`, tablas snake_case vía `@@map`, `tenant_id` en toda tabla de negocio, `metadata Json?` para extender sin migración).
- Las migraciones SQL viven en `producto/trackt-api/supabase/migrations/` (RLS, triggers, buckets de storage, realtime) — no se usa `prisma migrate`. Prisma solo genera el cliente.
- Las FKs hacia `auth.users` de Supabase son `String` UUID sin relación Prisma (schemas distintos).

### Auth y multi-tenant (backend)

Flujo central que cruza todos los módulos:

1. `AuthGuard` (`src/auth/auth.guard.ts`) valida el Bearer token contra Supabase Auth, carga el perfil (`ProfileService`) y adjunta `req.user: AuthUser` con `role` y `tenantId`.
2. `RolesGuard` + decorador `@Roles(...)` restringen por rol: `admin`, `jefe_taller`, `mechanic`.
3. `TenantService` (`src/common/tenant/`) resuelve el tenant desde `req.user`; todo query de negocio filtra por `tenant_id`. Nunca aceptar `tenant_id` desde el body/query del cliente.

Módulos NestJS por dominio: `equipos`, `ordenes`, `tickets`, `evidencias`, `inventario`, `notificaciones`, `usuarios`. `PrismaExceptionFilter` global mapea errores Prisma a HTTP.

### Máquinas de estado del dominio

- OT: `PENDIENTE → EN_PROCESO → CERRADA` (o `CANCELADA`). Pasa a `EN_PROCESO` al crear su primer ticket; a `CERRADA` cuando todos sus tickets cierran.
- Ticket: `PENDIENTE → ASIGNADO → EN_EJECUCION → EJECUTADO → CERRADO` (o `CANCELADO`). Mecánico ejecuta; admin valida y cierra. Las transiciones tienen guards anti-TOCTOU en `tickets.service.ts`.
- Inventario: movimientos `ENTRADA/SALIDA/AJUSTE/RESERVA/LIBERACION/CONSUMO`; reservas de repuestos ligadas a tickets con estados propios.

### Frontend

- App Router con route groups: `src/app/(auth)/` (login) y `src/app/(app)/` (vistas protegidas: dashboard, equipos, ordenes, tickets, mis-tickets, inventario, taller, usuarios…).
- `src/proxy.ts` (el reemplazo de middleware en Next 16) refresca la sesión Supabase en cada request vía `lib/supabase/middleware.ts`.
- Llamadas a la API: wrappers por dominio en `src/lib/api/*` sobre `authFetch` (`lib/api/http.ts`), que adjunta el access_token de Supabase como Bearer y reintenta una vez tras refresh si recibe 401. El cliente Supabase de browser se crea lazy — no crear clientes a nivel de módulo.
- Estado servidor con React Query: hooks por dominio en `src/hooks/use-*.ts`. Server Actions solo en `src/app/actions/` (auth, profile, users).
- `producto/tract-front/CLAUDE.md` → `AGENTS.md`: Next.js 16 tiene breaking changes respecto a versiones previas — leer la guía relevante en `node_modules/next/dist/docs/` antes de escribir código que use APIs de Next.

## Convenciones Git (documentacion/gitflow.md)

- Regla de oro: **una rama = un ticket de Linear = un PR**. Ramas nacen de `main`.
- Ramas: `<tipo>/<TRA-ID>-<descripcion-kebab>` (ej. `feat/TRA-12-login-google`). El ID de Linear es obligatorio para la vinculación automática.
- Commits: `<tipo>(<scope>): <mensaje> (TRA-12)` con scope `api`, `front` o `repo`.

## Entorno

- Backend `producto/trackt-api/.env`: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT=3001`.
- Frontend `producto/tract-front/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (http://localhost:3001), `NEXT_PUBLIC_SITE_URL`.
- Credenciales demo tras `db:seed`: `admin@trackt.demo` / mecánicos `mecanico1..4@trackt.demo`, password `Trackt!2026`.
