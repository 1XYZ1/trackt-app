# Trackt API — Notas de proyecto

## Fase 3: plantillas de mantenimiento con insumos (2026-06)

Una plantilla es una "receta" reutilizable de mantención: checklist de pasos
e insumos sugeridos. En fases 4+ alimenta programaciones de calendario,
generación de OT/tickets y reservas de inventario.

### Modelos nuevos

- `PlantillaMantenimiento` (`plantillas_mantenimiento`): nombre, descripcion,
  `tipoEquipo` (texto libre, matchea `Equipo.tipo`), `frecuencia` (texto
  libre — "mensual", "500 horas" — se formaliza en Fase 4), `activo`,
  `metadata`. El checklist vive en `metadata.checklist` como `string[]`.
- `PlantillaMantenimientoItem` (`plantillas_mantenimiento_items`): insumo
  sugerido. Unique `(tenantId, plantillaId, repuestoId)`; `cantidad > 0`
  (CHECK en BD); `obligatorio` (default true) distingue insumos que la
  reserva podrá omitir; FK repuesto `onDelete: Restrict`.
- `EquipoPlantillaMantenimiento` (`equipos_plantillas_mantenimiento`): qué
  plantillas aplican a cada equipo. Unique `(tenantId, equipoId, plantillaId)`;
  FKs equipo/plantilla `Cascade`.

Migración: `supabase/migrations/20260611120000_plantillas_mantenimiento.sql`
(idempotente, RLS: lectura tenant / escritura admin+jefe_taller en las 3
tablas — mismo criterio que `equipos_repuestos`).

### Endpoints nuevos

| Método | Path                                             | Roles                        | Descripción                                  |
| ------ | ------------------------------------------------ | ---------------------------- | -------------------------------------------- |
| GET    | `/plantillas-mantenimiento`                      | admin, jefe_taller, mechanic | Lista paginada (+`itemsCount`). Filtros: `search`, `tipoEquipo`, `includeInactive`. |
| GET    | `/plantillas-mantenimiento/:id`                  | admin, jefe_taller, mechanic | Detalle con items (repuesto + stock disponible). |
| POST   | `/plantillas-mantenimiento`                      | admin, jefe_taller           | Crea plantilla. Valida `metadata.checklist` (string[] no vacíos, máx 100). |
| PATCH  | `/plantillas-mantenimiento/:id`                  | admin, jefe_taller           | Edita; `activo: true` reactiva; string vacío limpia opcionales. |
| PATCH  | `/plantillas-mantenimiento/:id/desactivar`       | admin, jefe_taller           | Baja lógica (no toca asociaciones existentes). |
| POST   | `/plantillas-mantenimiento/:id/items`            | admin, jefe_taller           | Agrega insumo (`{ repuestoId, cantidad, obligatorio?, observacion? }`). 404 repuesto ajeno, 409 dup/inactivo. |
| PATCH  | `/plantillas-mantenimiento/:id/items/:itemId`    | admin, jefe_taller           | Edita cantidad/obligatorio/observacion (400 si body vacío). |
| DELETE | `/plantillas-mantenimiento/:id/items/:itemId`    | admin, jefe_taller           | Quita el insumo. |
| GET    | `/equipos/:equipoId/plantillas`                  | admin, jefe_taller, mechanic | Plantillas asociadas al equipo (+`itemsCount`). |
| POST   | `/equipos/:equipoId/plantillas/:plantillaId`     | admin, jefe_taller           | Asocia plantilla. **409 si la plantilla está inactiva** o ya asociada. |
| DELETE | `/equipos/:equipoId/plantillas/:plantillaId`     | admin, jefe_taller           | Quita la asociación. |

### Decisiones

- **Checklist en `metadata.checklist`** (string[]): versión simple y estable.
  El service valida forma (arreglo de strings no vacíos, máx 100 pasos de
  hasta 500 chars). Si la operación llega a necesitar estado/orden/fotos por
  paso, migrar a tabla `plantillas_mantenimiento_checklist` en una fase
  posterior — la API actual no cambiaría (el detalle seguiría devolviendo
  `checklist`).
- **Plantilla inactiva**: no puede asociarse a equipos (409). Sus ítems sí
  pueden editarse (preparar la receta antes de reactivar). La Fase 4 debe
  repetir la validación `activo` al crear programaciones desde plantilla.
- `tipoEquipo` es informativo (sugerencia de filtro en el front); no se
  bloquea asociar una plantilla a un equipo de otro tipo.

## Fase 2: marcas, catálogos y repuestos por equipo (2026-06)

Datos maestros para equipos/inventario y la base de las plantillas de
mantenimiento (Fase 3+): poder decir "este equipo usa normalmente estos
repuestos".

### Modelos nuevos

- `Marca` (`marcas`): catálogo por tenant. `tipo` es enum `MarcaTipo`
  (`EQUIPO | REPUESTO | AMBOS`) — se eligió enum en vez de String por
  consistencia con el resto del schema. Unique `(tenantId, nombre, tipo)`;
  el dup check del service es case-insensitive.
- `EquipoRepuesto` (`equipos_repuestos`): repuestos habituales de un equipo.
  Unique `(tenantId, equipoId, repuestoId)`; `cantidadRef` opcional (> 0,
  CHECK en BD); FK repuesto con `onDelete: Restrict`.
- `Repuesto` gana `marcaId` (FK `SetNull`), `codigoFabricante`,
  `ubicacionBodega`, `proveedor`. Compatibilidad: `Equipo.marca` (texto
  libre) NO se migra aún — la adopción de `marcaId` en equipos será
  progresiva cuando el frontend consuma el catálogo.

Migración: `supabase/migrations/20260611000000_marcas_equipos_repuestos.sql`
(idempotente, con RLS: lectura tenant / escritura admin para marcas;
lectura tenant / escritura admin+jefe_taller para equipos_repuestos).

### Endpoints nuevos

| Método | Path                                  | Roles                        | Descripción                                  |
| ------ | ------------------------------------- | ---------------------------- | -------------------------------------------- |
| GET    | `/marcas`                              | admin, jefe_taller, mechanic | Lista paginada. `tipo` filtra por ámbito (REPUESTO incluye AMBOS). |
| POST   | `/marcas`                              | admin                        | Crea marca (nombre trim, 409 dup case-insensitive). |
| PATCH  | `/marcas/:id`                          | admin                        | Edita nombre/tipo/metadata; `activo: true` reactiva. |
| PATCH  | `/marcas/:id/desactivar`               | admin                        | Baja lógica (no toca repuestos que la referencian). |
| GET    | `/equipos/:id/repuestos`               | admin, jefe_taller, mechanic | Repuestos habituales del equipo (con stock disponible). |
| POST   | `/equipos/:id/repuestos`               | admin, jefe_taller           | Asocia repuesto (`{ repuestoId, cantidadRef?, observacion? }`). 409 dup/inactivo. |
| DELETE | `/equipos/:id/repuestos/:repuestoId`   | admin, jefe_taller           | Quita la asociación. |

Inventario: `POST/PATCH /inventario/repuestos` aceptan `marcaId` (debe ser
marca del tenant, activa, ámbito REPUESTO/AMBOS — 404/409 si no),
`codigoFabricante`, `ubicacionBodega`, `proveedor`; `GET /inventario/repuestos`
filtra por `marcaId` y el detalle incluye `marca { id, nombre }`.

## Módulo `equipos` — Fase 1: ficha central (2026-06)

El equipo es el eje de la app: la OT y los tickets son parte de su historial.

### Campos nuevos en `Equipo`

`tipo`, `numeroSerie`, `fechaInstalacion`, `fechaCompra`, `estadoOperativo`
(enum `EquipoEstadoOperativo`: `OPERATIVO | EN_MANTENIMIENTO | FUERA_DE_SERVICIO`,
default `OPERATIVO`) y `qrToken` (único, opaco). Migración:
`supabase/migrations/20260610000000_equipos_ficha.sql`. Se decidió columna real
(no metadata) para todos porque se filtran/buscan (tipo, numeroSerie,
estadoOperativo) o son fechas tipadas; `metadata` sigue disponible para extras.

### Normalización (create/update)

- `codigo`: `trim().toUpperCase()` — el check de duplicado usa el valor normalizado,
  así `" eq-100 "` y `"EQ-100"` son el mismo código.
- `nombre/tipo/marca/modelo/numeroSerie/ubicacion`: `trim()`; string vacío → `null`.
- `codigo`/`nombre` de solo espacios → 400.
- En update, `null` explícito limpia el campo (patrón existente).

### Endpoints nuevos

| Método | Path                    | Roles                        | Descripción                                  |
| ------ | ----------------------- | ---------------------------- | -------------------------------------------- |
| POST   | `/equipos/:id/qr`       | admin                        | Genera/regenera `qrToken` (invalida el previo). |
| GET    | `/equipos/qr/:qrToken`  | admin, jefe_taller, mechanic | Resuelve equipo por QR. Scoped al tenant del usuario (QR ajeno → 404). |
| GET    | `/equipos/:id/resumen`  | admin, jefe_taller, mechanic | Ficha: equipo + estadísticas + últimas 5 OTs/tickets + alertas. |

### Resumen — decisiones

- `ordenesCerradas` cuenta solo `CERRADA` (CANCELADA no es cierre operativo).
- `ticketsActivos` = `PENDIENTE/ASIGNADO/EN_EJECUCION/EJECUTADO`; tickets se
  navegan vía `ot.equipoId` (no tienen equipoId directo).
- `repuestosConsumidos` = unidades consumidas (suma de movimientos `CONSUMO`
  en valor absoluto).
- `proximasProgramaciones: []` — se completa en Fase 4 (calendario).
- `alertas`: `EQUIPO_INACTIVO`, `FUERA_DE_SERVICIO` / `EN_MANTENIMIENTO`,
  `OT_PRIORIDAD_ALTA` (OTs abiertas con prioridad ALTA).

### Seguridad QR

La resolución por QR requiere auth y filtra por tenant del solicitante. Si a
futuro se necesita resolución pública (escaneo sin login), exponer un endpoint
separado con proyección mínima + rate-limit; no reutilizar este.

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
