# Trackt API — Notas de proyecto

## Revisión integral post-fases (2026-06-12)

Auditoría de seguridad/consistencia tras completar las fases 1–6, más
refactors menores. Resultados de la auditoría:

- **Multi-tenant**: todas las lecturas usan `id + tenantId` (no hay
  `findUnique`/`findFirst` solo por id); los `update`/`delete` por id van
  precedidos de verificación de tenant, y donde la carrera importa se usa
  `updateMany` condicionado (tickets, programaciones, cancelaciones).
  Evidencias (sin tenant_id propio) se scopean siempre vía ticket.
- **Transacciones**: creación de OT/ticket/reserva, generar-ot, stock
  (entrada/ajuste/aprobar/liberar/consumir) y cancelaciones en cascada son
  transaccionales, con advisory locks por secuencia y por repuesto.
- **Reservas**: una sola fuente (`InventarioService.crearReservaEnTx`);
  el acceso a tickets para reservas centralizado en `assertCanActOnTicket`.
- **Stock**: `stockReservado` solo lo mueven aprobar/crear RESERVADA,
  liberar (con piso 0) y consumir (descuenta actual+reservado); SOLICITADA
  nunca toca stock. Sin caminos que dejen reservado colgado: cancelar
  OT/ticket libera vía `liberarReservasDeTicket`.
- **Doble generación**: bloqueada por pre-check + guard `updateMany`
  condicionado a PROGRAMADA dentro de la tx (cubierto por tests).

Refactors aplicados:

- `ProfileService` (auth, global) es ahora el punto único de acceso a
  `public.profiles` para nombres (`getUserSummaries`) y pertenencia al
  tenant (`existsInTenant`). Migrados: ordenes-pdf, reportes,
  programaciones, y luego también `TicketsService`/`OrdenesService`
  (rama refactor-decorators-profiles). Los queries con rol de la
  asignación de tickets y el de carga de mecánicos siguen en
  TicketsService a propósito (son consultas especializadas, no lookups
  de nombres).
- `common/utils/codigo.util.ts` (`siguienteCodigo`): lógica de secuencia
  PREFIJO-NNNN compartida por OT y tickets.
- Código muerto eliminado: `OrdenesService.onTicketCreated` (nadie lo
  invocaba — la transición PENDIENTE→EN_PROCESO se hace inline y con guard
  en las tx) e import sin uso en `prisma-exception.filter`.
- `package.json`: eliminado `test:e2e` (no existe `test/`), `format` y
  `lint` apuntan solo a `src`.

Refactor mecánico posterior (rama `refactor-decorators-profiles`, al tope
de la pila):

- **Decorators `@TenantId()`/`@CurrentUser()`** en `common/decorators/`,
  aplicados a los 14 controllers. `TenantService`/`TenantModule`
  eliminados (quedaron sin uso). Nota: los tipos en firmas decoradas
  requieren `import type` (TS1272 con isolatedModules +
  emitDecoratorMetadata).

Decisiones de NO hacer (con razón):

- **Centralizar reglas de acceso a tickets más allá de reservas**: las
  transiciones de tickets tienen reglas por estado/rol deliberadamente
  específicas; extraerlas hoy agrega indirection sin un tercer consumidor.

Inconsistencias de roles detectadas (decisión de producto, no se cambió):

- `POST/PATCH /ordenes` permiten `admin, mechanic` pero NO `jefe_taller`
  (que sí puede generar OTs desde programaciones); `POST /ordenes/:id/cancelar`
  es solo admin. Revisar si jefe_taller debería poder crear/editar/cancelar.
- `PATCH /marcas/*` es solo admin mientras el resto de catálogos de
  mantenimiento (plantillas, programaciones) son admin+jefe_taller.

## Fase 6: historial, PDF de OT y reportes descargables (2026-06)

Cierra el ciclo: equipo → programación → OT/ticket → reserva → ejecución →
consumo/liberación → historial → PDF/reporte. Sin cambios de schema.
Dependencia nueva: `pdfkit` (+ `@types/pdfkit` dev) — generación en memoria,
sin navegador headless.

### Historial del equipo

`GET /equipos/:id/historial` (admin, jefe_taller, mechanic): ficha + OTs +
tickets + evidencias + reservas + movimientos + **consumo agregado por
repuesto** (`repuestosConsumidos`, unidades en valor absoluto) +
programaciones. Filtros `desde`/`hasta` (createdAt; fechaProgramada en
programaciones) y `estado` — se aplica a cada colección cuyo enum contenga
el valor (PENDIENTE → OTs y tickets; 400 si no calza con ninguno). Cada
colección viene acotada (take 100/200) y ordenada desc. Evidencias se
scopean vía ticket (no tienen tenant_id propio).

### PDF de OT

`GET /ordenes/:id/pdf` (admin, jefe_taller, mechanic) → `application/pdf`
inline (`OT-YYYY-NNNN.pdf`). Incluye: código, equipo (código/nombre/tipo/
ubicación), descripción, prioridad, estado, fechas, creador, tickets con
mecánicos (nombres desde profiles), reservas con items, consumos agregados,
evidencias resumidas, líneas para observaciones y doble espacio de firma
(responsable / supervisor). `OrdenesPdfService` arma un Buffer con pdfkit;
el controller responde con `StreamableFile`.

### Módulo reportes (`src/reportes/`)

Roles: admin + jefe_taller. `formato=json` (default: `{ data, total }`) |
`formato=csv` (attachment con BOM UTF-8, RFC 4180, `csv.util.ts` propio sin
dependencias). xlsx/pdf quedaron fuera a propósito: CSV abre en Excel y el
único PDF con layout real es el de la OT.

| Endpoint | Cubre |
| -------- | ----- |
| `GET /reportes/equipos` | actividad por equipo, ordenado por total de OTs desc → **equipos con más fallas** |
| `GET /reportes/equipos/:id/historial` | historial (JSON completo; CSV = línea de tiempo aplanada `fecha,tipo,codigo,detalle,estado`) |
| `GET /reportes/ordenes?desde&hasta&estado` | **OT por rango de fechas** |
| `GET /reportes/tickets?estado&mecanicoId&desde&hasta` | **tickets por estado / por mecánico** (nombres desde profiles) |
| `GET /reportes/inventario` (vista=stock, `soloCriticos`) | existencias + **stock crítico** (disponible ≤ mínimo) |
| `GET /reportes/inventario?vista=consumos&equipoId&desde&hasta` | **consumo por equipo** y **repuestos más consumidos** (orden desc) |
| `GET /reportes/mantenimientos?vista=todos\|vencidos\|proximos` | **mantenimientos vencidos** (PROGRAMADA pasada, con `diasAtraso`) y **próximos** |

`ReportesService` reutiliza `EquiposService.historial` (EquiposModule ahora
exporta el service). La reserva sigue viviendo en el ticket — los reportes
son lecturas agregadas, nada se mueve de lugar.

### Nota técnica

El tipado de `groupBy` de Prisma exige `orderBy` y no sobrevive dentro del
array de `$transaction([...])` — los groupBy van como awaits separados /
`Promise.all` (lecturas agregadas, no necesitan transaccionalidad).

## Fase 5: generar OT/ticket con reserva desde plantilla (2026-06)

El flujo principal del sistema: programación → OT → ticket → reserva de
insumos desde la plantilla → stock reservado. Sin cambios de schema (no hay
migración nueva).

### Endpoint nuevo

| Método | Path                                            | Roles                        |
| ------ | ------------------------------------------------ | ---------------------------- |
| POST   | `/programaciones-mantenimiento/:id/generar-ot`   | admin, jefe_taller, mechanic |

Body (`GenerarOtDto`): `{ modoReserva?: "AUTOMATICA"|"SUGERIDA",
ajustarItems?: [{ repuestoId, cantidad }], observacion? }`.

Comportamiento (todo en UNA transacción):

1. Programación del tenant (404) y en `PROGRAMADA` (409 — cubre la doble
   generación; además hay guard anti-TOCTOU: `updateMany` condicionado al
   estado dentro de la tx, count=0 → 409).
2. Equipo del tenant (404) y activo (409).
3. Crea OT (`OrdenesService.crearEnTx`: advisory lock + código OT-YYYY-NNNN)
   con `metadata.programacionId`, prioridad heredada de la programación.
4. Crea 1 ticket (`TicketsService.crearEnTx`: lock + TKT-YYYY-NNNN + evento
   inicial) y transiciona la OT `PENDIENTE → EN_PROCESO` (guard updateMany,
   misma semántica que el hook onTicketCreated pero atómica).
5. Si hay plantilla y `modoReserva=AUTOMATICA` (default): crea la reserva
   **sobre el ticket** con `InventarioService.crearReservaEnTx` — la misma
   lógica de `POST /tickets/:id/reservas-repuestos`, extraída para correr
   en una tx externa. `RESERVADA` para admin/jefe (aplica stockReservado +
   movimientos RESERVA); `SOLICITADA` para mechanic (sin tocar stock, va a
   aprobación como siempre).
6. `ajustarItems` ajusta cantidades de la plantilla (cantidad 0 excluye el
   insumo; repuesto fuera de la plantilla → 400).
7. Marca `GENERADA` y guarda trazabilidad en
   `metadata.generacion = { otId, otCodigo, ticketId, ticketCodigo,
   reservaId, generadoPorId, fecha }`.

`modoReserva=SUGERIDA`: genera OT/ticket y marca GENERADA, pero **no crea
la reserva**; la respuesta incluye `itemsSugeridos` (insumos de la plantilla
con ajustes y stock disponible) para que el usuario cree la reserva ajustada
con los endpoints existentes de tickets. No se implementó estado "borrador".

### Stock insuficiente

`crearReservaEnTx` valida TODOS los items y lanza 409 con payload
estructurado: `{ message: "Stock insuficiente para generar reserva",
faltantes: [{ repuestoId, codigo, nombre, requerido, disponible }] }`.
Como el error nace dentro de la transacción, la OT, el ticket y el cambio a
GENERADA se revierten juntos — no quedan datos a medias. Este payload ahora
también aplica a `POST /tickets/:id/reservas-repuestos` (antes reportaba
solo el primer faltante como string; sigue siendo 409).

### Refactor de reutilización (sin romper endpoints)

- `InventarioService.crearReservaEnTx(tx, ...)`: núcleo de createReserva
  (dedup+locks ordenados, validación, creación, stockReservado+movimientos,
  SOLICITADA vs RESERVADA). `createReserva` mantiene su contrato (valida
  ticket/permisos y abre su propia tx).
- `OrdenesService.crearEnTx(tx, ...)` y `TicketsService.crearEnTx(tx, ...)`:
  lock de secuencia + código + create (+ evento inicial en tickets),
  reutilizados por `create`/`createFromOrden`.

### Pendiente (decisión consciente, fuera del scope del prompt de Fase 5)

- Recurrencia: al generar NO se crea la siguiente ocurrencia.
- `VENCIDA`/`COMPLETADA` siguen sin setearse automáticamente (job de
  vencimiento y cierre por OT cerrada).

## Fase 4: calendario y programación de mantenimiento (2026-06)

Una programación es un trabajo futuro planificado sobre un equipo,
opcionalmente basado en una plantilla. En Fase 5 genera OT/tickets
(estado → GENERADA) y reserva insumos desde la plantilla.

### Modelo nuevo

- `ProgramacionMantenimiento` (`programaciones_mantenimiento`): equipo,
  plantilla opcional (FK `SetNull`), titulo, fechaProgramada,
  `responsableId` (auth.users.id, validado contra `public.profiles` del
  tenant — mismo patrón que la asignación de tickets), prioridad, estado
  y `recurrencia` (texto libre; se materializa al generar la siguiente
  ocurrencia en Fase 5).
- Estado: enum `ProgramacionMantenimientoEstado`
  (`PROGRAMADA | GENERADA | CANCELADA | VENCIDA | COMPLETADA`) — enum y no
  String por consistencia con el schema. Transiciones implementadas:
  `PROGRAMADA → CANCELADA` (endpoint, guard anti-TOCTOU con updateMany
  condicionado). `GENERADA`/`VENCIDA`/`COMPLETADA` las setea la Fase 5
  (generación de OT / job de vencimiento / cierre).

Migración: `supabase/migrations/20260611180000_programaciones_mantenimiento.sql`
(idempotente, RLS lectura tenant / escritura admin+jefe_taller).

### Endpoints nuevos

| Método | Path                                          | Roles                        | Descripción                                  |
| ------ | --------------------------------------------- | ---------------------------- | -------------------------------------------- |
| GET    | `/programaciones-mantenimiento`               | admin, jefe_taller, mechanic | Lista paginada. Filtros: `desde`, `hasta`, `equipoId`, `estado`, `responsableId`, `plantillaId`. |
| GET    | `/programaciones-mantenimiento/calendario`    | admin, jefe_taller, mechanic | Eventos planos `{ id, title, start, estado, prioridad, equipo, plantilla }`. Rango obligatorio, máx 366 días. |
| GET    | `/programaciones-mantenimiento/:id`           | admin, jefe_taller, mechanic | Detalle con equipo y plantilla. |
| POST   | `/programaciones-mantenimiento`               | admin, jefe_taller           | Crea. `titulo` opcional si hay plantilla (usa su nombre). |
| PATCH  | `/programaciones-mantenimiento/:id`           | admin, jefe_taller           | Edita **solo en estado PROGRAMADA** (409 si no). `plantillaId`/`responsableId: null` desvinculan. |
| PATCH  | `/programaciones-mantenimiento/:id/cancelar`  | admin, jefe_taller           | `PROGRAMADA → CANCELADA` (409 desde otros estados). |

### Validaciones

- Equipo del tenant (404) y activo (409 si está de baja).
- Plantilla del tenant (404) y **activa** (409) — el compromiso que dejó
  la Fase 3 para acá.
- `fechaProgramada` válida y no en el pasado (se compara contra el inicio
  del día UTC para no rechazar "hoy").
- `responsableId` debe existir en `public.profiles` del tenant (404).
- Rango `desde`/`hasta` consistente (400 si invertido).

### Integración con la ficha del equipo

`GET /equipos/:id/resumen` ahora completa `proximasProgramaciones`
(pendiente desde Fase 1): las próximas 5 `PROGRAMADA` con fecha >= hoy,
con `{ id, titulo, fechaProgramada, estado, prioridad, plantilla }`.

### Pendientes para Fase 5

- Generar OT/tickets desde programaciones (PROGRAMADA → GENERADA) y crear
  la siguiente ocurrencia según `recurrencia`.
- Job/criterio para marcar `VENCIDA` y cierre a `COMPLETADA`.
- Reserva de insumos desde la plantilla al generar la OT.

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

`OrdenesService` expone un hook que `TicketsService` invoca:

- `onTicketEstadoCambiado(tenantId, otId, tx?)` — llamar **cuando un ticket cambia de estado**. Si la OT está `EN_PROCESO` y todos sus tickets quedaron `CERRADO`, la cierra (`CERRADA` + `fechaCierre`).
- (`onTicketCreated` existió como hook para la transición `PENDIENTE → EN_PROCESO`, pero se eliminó en la revisión integral: la transición se hace inline y con guard dentro de las transacciones de `createFromOrden` y `generarOt`.)

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
