# Trackt API — Notas de proyecto

## Módulo `ordenes` (API-02)

Implementa el CRUD de Órdenes de Trabajo (OT). Una OT es la **entrada externa** del flujo (un cliente o supervisor solicita una mantención sobre un equipo); puede dar origen a 1..N tickets internos.

### Endpoints

Base path: `/ordenes`. Todos los endpoints requieren `AuthGuard + RolesGuard`.

| Método | Path                    | Roles            | Descripción                                                       |
| ------ | ----------------------- | ---------------- | ----------------------------------------------------------------- |
| POST   | `/ordenes`              | admin, mechanic  | Crea OT en `PENDIENTE` con código `OT-YYYY-NNNN`.                 |
| GET    | `/ordenes`              | admin, mechanic  | Lista paginada. Filtros: `estado`, `equipoId`, `page`, `limit`.   |
| GET    | `/ordenes/:id`          | admin, mechanic  | Detalle. Incluye `equipo` y `tickets[]` derivados.                |
| PATCH  | `/ordenes/:id`          | admin, mechanic  | Actualiza `descripcion` y/o `prioridad`. Solo si está `PENDIENTE`.|
| POST   | `/ordenes/:id/cancelar` | admin            | Cancela OT y arrastra tickets en estado `PENDIENTE`.              |

Cuerpos:

- `POST /ordenes` → `{ equipoId, descripcion, prioridad? }` (`prioridad ∈ {BAJA, MEDIA, ALTA}`, default `MEDIA`).
- `PATCH /ordenes/:id` → `{ descripcion?, prioridad? }` (al menos uno).

### Reglas de transición de estado

Enum `OrdenTrabajoEstado`: `PENDIENTE | EN_PROCESO | CERRADA | CANCELADA`.

- Al crear: siempre `PENDIENTE`.
- `PENDIENTE → EN_PROCESO`: automático cuando se crea el primer ticket asociado (hook `onTicketCreated`).
- `EN_PROCESO → CERRADA`: automático cuando *todos* los tickets de la OT pasan a `CERRADO` (hook `onTicketEstadoCambiado`).
- `PENDIENTE | EN_PROCESO → CANCELADA`: vía `POST /ordenes/:id/cancelar`. Cancela en cascada los tickets asociados que estén en `PENDIENTE`; no toca tickets `ASIGNADO`, `EN_EJECUCION`, `EJECUTADO`, `CERRADO`.
- Bloqueadas: `CERRADA → *`, `CANCELADA → *`, y cualquier `update` sobre OTs que no estén `PENDIENTE`.

Toda la lógica de transición vive en `OrdenesService`; el controller solo resuelve `tenantId` y delega.

### Generación del código OT

Formato: `OT-{YYYY}-{secuencia}` con `secuencia` zero-padded a 4 dígitos (`OT-2026-0001`).

Implementación (`OrdenesService.create`):

1. Abrir `prisma.$transaction` (callback).
2. Tomar lock con `pg_advisory_xact_lock(hashtext('ot:<tenantId>:<year>'))`.
3. Buscar el último `codigo` del tenant que matchea el prefijo `OT-<year>-` (ordenado desc).
4. Calcular `nextSeq = parseInt(suffix) + 1` (o `1` si no hay).
5. Crear la OT con el código generado.

El advisory lock es por transacción (`xact_lock`), se libera al commit/rollback. Códigos legados que no matcheen el prefijo (ej. `OT-1001` del seed) son ignorados y no interfieren con la secuencia.

### Integración con tickets

Como `TicketsService` aún no existe, `OrdenesService` expone dos hooks que el futuro service de tickets debe invocar:

- `onTicketCreated(tenantId, otId)` — llamar **al crear un ticket**. Si la OT está `PENDIENTE`, la mueve a `EN_PROCESO` (idempotente; usa `updateMany` filtrando por estado).
- `onTicketEstadoCambiado(tenantId, otId)` — llamar **cuando un ticket cambia de estado**. Si la OT está `EN_PROCESO` y todos sus tickets quedaron `CERRADO`, la cierra (`CERRADA` + `fechaCierre`).

`OrdenesModule` exporta `OrdenesService`, así que basta importarlo desde el módulo de tickets.

### Modelo de datos

Los modelos `OrdenTrabajo` y `Ticket` (con relación `OrdenTrabajo.tickets ↔ Ticket.ot` vía `ot_id`) y los enums `OrdenTrabajoEstado` y `TicketEstado` (incluido `CANCELADO`) **ya existían** en `prisma/schema.prisma` y en `supabase/migrations/20260506045823_init_business_schema.sql`. No fue necesaria nueva migración.

Campos relevantes de `OrdenTrabajo`: `id`, `tenantId`, `codigo` (único por tenant), `equipoId`, `descripcion`, `prioridad`, `estado`, `creadoPorId` (UUID de `auth.users`), `fechaCierre`, timestamps.

### Tests

`src/ordenes/ordenes.service.spec.ts` cubre con mock de `PrismaService`:

- create: estado inicial `PENDIENTE`, formato `OT-YYYY-0001`, incremento de secuencia, uso de `$transaction` + advisory lock, equipo inexistente → 404.
- update: éxito en `PENDIENTE`, `ConflictException` en `EN_PROCESO/CERRADA/CANCELADA`, OT inexistente → 404.
- cancelar: transiciona a `CANCELADA` desde `PENDIENTE` y `EN_PROCESO`, cancela tickets solo en `PENDIENTE`, `ConflictException` desde `CERRADA/CANCELADA`.
- findOne: incluye `equipo` + `tickets`, filtra por tenant, 404 si no existe.
- findAll: aplica filtros `estado` y `equipoId` sobre el tenant.
- onTicketCreated: mueve `PENDIENTE → EN_PROCESO` vía `updateMany` filtrado, idempotente.
- onTicketEstadoCambiado: cierra OT cuando 100% de tickets están `CERRADO`, no cierra si quedan abiertos, no toca OTs fuera de `EN_PROCESO`, no cierra OTs sin tickets.

### Comandos

```bash
npm install
npx prisma generate
npx prisma validate
npm run build
npm test
```

Para la BD: las migraciones SQL están en `supabase/migrations/`. El seed (`npm run db:seed`) deja data demo con `TENANT_ID = "demo"`.
