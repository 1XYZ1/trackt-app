# Trackt — Fases 1-6: Mapa de Backend/DB integrado y Plan de implementación Front

> **Estado:** el backend (NestJS) y la base de datos (Supabase/Postgres) de las fases 1-6 están **mergeados en `main` y desplegados** (PR #54 fases 1-5 + #56 fase 6 / revisión integral). Las migraciones SQL ya corrieron en prod. **El frontend de estas features NO existe** (salvo CRUD legacy de equipos/órdenes/tickets/inventario). Este documento es la fuente única para planificar el front sin dejar nada afuera ni inconsistente.
>
> Rama: `main` @ `8a347ca`. Backend: `producto/trackt-api`. Front: `producto/tract-front`.

---

## 0. Convenciones transversales (aplican a TODO el front nuevo)

- **Auth:** todos los endpoints van detrás de `AuthGuard + RolesGuard`. El front ya tiene `authFetch` (`lib/api/http.ts`) que adjunta el Bearer de Supabase y reintenta 1 vez tras refresh en 401. Usar SIEMPRE `authFetch`.
- **Tenant:** el `tenant_id` se resuelve en el backend desde el token; **nunca** mandarlo desde el front.
- **Roles del sistema:** `admin`, `jefe_taller`, `mechanic`.
- **Paginación:** los listados devuelven `{ data: T[], total, page, limit, totalPages }`. Query base: `page?` (≥1, default 1), `limit?` (1–100, default 10).
- **CSV / PDF (descargas):** NO usar `response.json()`. Leer `await response.blob()` y disparar descarga (crear `URL.createObjectURL`, `<a download>`), o abrir en pestaña para el PDF. El `authFetch` sirve igual (devuelve `Response`).
- **Normalización:** el `codigo` de equipo se guarda y compara en `TRIM + UPPERCASE`. El front debería upper-case el input (ya hay patrón en `repuesto-form-sheet`).
- **`responsableId` (programaciones):** es un UUID de `auth.users` (Supabase), **sin join Prisma**. El front debe cruzarlo con el listado de usuarios (`lib/api/usuarios.ts`) para mostrar el nombre.
- **`metadata` (JSON):** varios modelos tienen `metadata Json?` libre. Caso especial: la plantilla guarda su **checklist** en `metadata.checklist: string[]`.

### ⚠️ Inconsistencias / cuidados a respetar
1. **Escritura de Marcas: solo `admin`** (RLS + @Roles). El resto de tablas nuevas admiten `admin` y `jefe_taller`.
2. **Reactivar:** Equipos tiene endpoint dedicado `PATCH /equipos/:id/reactivar`. **Marcas y Plantillas NO** — se reactivan con `PATCH .../:id` enviando `activo: true`.
3. **`qrToken` es único GLOBAL** (no por tenant), opaco. No se guarda imagen: el front renderiza el QR a partir del string. Regenerar invalida el anterior.
4. **CHECK en BD** (mandan 400/500 si se violan): `equipos_repuestos.cantidadRef` = NULL o >0; `plantillas_mantenimiento_items.cantidad` > 0.
5. **`generar-ot`** es el único endpoint de programaciones que permite `mechanic` (genera reserva `SOLICITADA`; admin/jefe genera `RESERVADA`).
6. **Reportes** solo emiten `json` o `csv` (no PDF/xlsx). El único PDF del sistema es `GET /ordenes/:id/pdf`.
7. **Repuesto extendido:** la tabla `repuestos` ganó `marcaId, codigoFabricante, ubicacionBodega, proveedor` — el front de inventario actual NO los muestra.

---

## 1. Enums (referencia para selects/badges)

| Enum | Valores |
|---|---|
| `EquipoEstadoOperativo` | `OPERATIVO`, `EN_MANTENIMIENTO`, `FUERA_DE_SERVICIO` |
| `MarcaTipo` | `EQUIPO`, `REPUESTO`, `AMBOS` |
| `Prioridad` | `BAJA`, `MEDIA`, `ALTA` |
| `ProgramacionMantenimientoEstado` | `PROGRAMADA`, `GENERADA`, `CANCELADA`, `VENCIDA`, `COMPLETADA` |
| `OrdenTrabajoEstado` | `PENDIENTE`, `EN_PROCESO`, `CERRADA`, `CANCELADA` |
| `TicketEstado` | `PENDIENTE`, `ASIGNADO`, `EN_EJECUCION`, `EJECUTADO`, `CERRADO`, `CANCELADO` |
| `ReservaRepuestoEstado` | `SOLICITADA`, `RESERVADA`, `CONSUMIDA`, `LIBERADA`, `CANCELADA` |
| `MovimientoInventarioTipo` | `ENTRADA`, `SALIDA`, `AJUSTE`, `RESERVA`, `LIBERACION`, `CONSUMO` |

---

## 2. FASE 1 — Equipo como ficha central (QR, estado operativo, resumen, historial)

### DB
Columnas nuevas en `equipos`: `tipo` (text, null), `numeroSerie` (text, null), `fechaInstalacion` (timestamp, null), `fechaCompra` (timestamp, null), `estadoOperativo` (enum, **NOT NULL default `OPERATIVO`**), `qrToken` (text, null, **único global**). Índice `(tenant_id, estado_operativo)`.

### Endpoints (`@Controller('equipos')`)
| Método + Path | Roles | Request | Respuesta |
|---|---|---|---|
| `GET /equipos` | admin, jefe, mech | query: `page?,limit?,search? (≤100),estadoOperativo?,includeInactive?` | **Paginado**. Item (LIST): `{id,codigo,nombre,tipo,marca,modelo,ubicacion,estadoOperativo,activo}` |
| `GET /equipos/:id` | admin, jefe, mech | — | Equipo (DETAIL): `{id,codigo,nombre,tipo,marca,modelo,numeroSerie,ubicacion,estadoOperativo,fechaInstalacion,fechaCompra,qrToken,activo,metadata,createdAt,updatedAt}` |
| `GET /equipos/qr/:qrToken` | admin, jefe, mech | — | Equipo DETAIL por token (404 si no es del tenant) |
| `GET /equipos/:id/resumen` | admin, jefe, mech | — | `{equipo(DETAIL), estadisticas:{ordenesAbiertas,ordenesCerradas,ticketsActivos,ticketsCerrados,reservasActivas,repuestosConsumidos}, ultimasOrdenes[≤5], ultimosTickets[≤5], proximasProgramaciones[≤5], alertas:[{tipo,mensaje}]}`. Alertas: `EQUIPO_INACTIVO,FUERA_DE_SERVICIO,EN_MANTENIMIENTO,OT_PRIORIDAD_ALTA` |
| `GET /equipos/:id/historial` | admin, jefe, mech | query: `desde? (ISO), hasta? (ISO), estado? (≤30)` | `{equipo, filtros, ordenes[≤100], tickets[≤100], evidencias[≤100], reservas[≤100], movimientos[≤200], repuestosConsumidos[] (agregado), programaciones[≤100]}` |
| `POST /equipos` | **admin** | CreateEquipoDto: `codigo!(≤60,único), nombre!(≤120), tipo?/marca?/modelo?(≤60), numeroSerie?/ubicacion?(≤120), estadoOperativo?, fechaInstalacion?/fechaCompra?(Date), metadata?` | Equipo DETAIL (409 si código dup) |
| `PATCH /equipos/:id` | **admin** | UpdateEquipoDto (todo opcional; `null` limpia campo) | Equipo DETAIL |
| `PATCH /equipos/:id/desactivar` (200) | **admin** | — | Equipo `activo:false` |
| `PATCH /equipos/:id/reactivar` (200) | **admin** | — | Equipo `activo:true` |
| `POST /equipos/:id/qr` (200) | **admin** | — | Equipo con nuevo `qrToken` |

### Front (estado: **NO EXISTE** salvo lista CRUD)
Hoy: `app/(app)/equipos/{page,equipos-client}.tsx` (solo lista). `lib/api/equipos.ts` type **sin** los campos nuevos. Sin ruta de detalle.

A construir:
- **API** (`lib/api/equipos.ts`): agregar campos nuevos al type `Equipo`; `getEquipo(id)`, `getEquipoResumen(id)`, `getEquipoHistorial(id,filtros)`, `generarQr(id)`, `getEquipoByQr(token)`; extender Create/Update payloads.
- **Hooks** (`hooks/use-equipos.ts`): `useEquipo`, `useEquipoResumen`, `useEquipoHistorial`, `useGenerarQr`.
- **Página nueva**: `app/(app)/equipos/[id]/page.tsx` — ficha con tabs (Resumen, Historial, Repuestos, Plantillas, Programaciones). Hacer navegables las filas de la tabla actual.
- **Componentes**: card de resumen + alertas; timeline de historial con filtros desde/hasta/estado; `StatusBadge` para `estadoOperativo`; modal de QR (render del token → imagen, ej. `qrcode.react`); campo `estadoOperativo` + nuevos en `equipo-form-sheet.tsx`.

---

## 3. FASE 2 — Catálogo de Marcas

### DB — `marcas`
`{id, tenantId, nombre, tipo(MarcaTipo), activo(default true), metadata?, createdAt, updatedAt}`. Único `(tenantId, nombre, tipo)`. FK tenant Cascade.

### Endpoints (`@Controller('marcas')`)
| Método + Path | Roles | Request | Respuesta |
|---|---|---|---|
| `GET /marcas` | admin, jefe, mech | query: `page?,limit?,search?(≤80),tipo?(MarcaTipo),includeInactive?` | **Paginado** `{id,nombre,tipo,activo,metadata,createdAt,updatedAt}` |
| `POST /marcas` | **admin** | `nombre!(≤80), tipo!(MarcaTipo), metadata?` | Marca (409 si nombre+tipo dup, case-insensitive) |
| `PATCH /marcas/:id` | **admin** | `nombre?, tipo?, activo?(reactivar), metadata?` | Marca |
| `PATCH /marcas/:id/desactivar` (200) | **admin** | — | Marca `activo:false` |

> Filtro por `tipo`: `EQUIPO` trae {EQUIPO,AMBOS}; `REPUESTO` trae {REPUESTO,AMBOS}.

### Front (estado: **NO EXISTE** — `marca` es solo texto libre hoy)
A construir:
- **API nuevo** `lib/api/marcas.ts`: `getMarcas(filtros)`, `createMarca`, `updateMarca`, `desactivarMarca`.
- **Hook nuevo** `hooks/use-marcas.ts`.
- **Página nueva** `app/(app)/marcas/page.tsx` (ABM).
- **Componentes**: tabla + form-sheet de marcas; **`MarcaSelect`** reutilizable (reemplaza el texto libre `marca` en equipos y repuestos).
- **Menú**: entrada "Marcas" en `sidebar-data.ts` (Administración).

---

## 4. FASE 2/3 — Repuestos extendidos + asociación Equipo↔Repuesto

### DB
`repuestos` gana: `marcaId` (FK→marcas, SetNull, null), `codigoFabricante`, `ubicacionBodega`, `proveedor` (text null). Tabla nueva **`equipos_repuestos`** `{id,tenantId,equipoId,repuestoId,cantidadRef?(>0),observacion?,createdAt}`, único `(tenant,equipo,repuesto)`.

### Endpoints (`@Controller('equipos')` → `EquiposRepuestosController`)
| Método + Path | Roles | Request | Respuesta |
|---|---|---|---|
| `GET /equipos/:id/repuestos` | admin, jefe, mech | — | `[{id,equipoId,cantidadRef,observacion,createdAt,repuesto:{id,codigo,nombre,unidad,activo,marcaId,stockDisponible}}]` |
| `POST /equipos/:id/repuestos` | admin, jefe | `repuestoId!(≤60), cantidadRef?(≥1), observacion?(≤300)` | Asociación (409 si inactivo o ya asociado) |
| `DELETE /equipos/:id/repuestos/:repuestoId` (200) | admin, jefe | — | `{deleted:true,equipoId,repuestoId}` |

### Front (estado: **PARCIAL** — repuestos básicos sí, extendidos y asociación NO)
A construir:
- **API**: extender type `Repuesto` + payloads en `lib/api/inventario.ts` con `marcaId, codigoFabricante, ubicacionBodega, proveedor`; agregar `getEquipoRepuestos(id)`, `addEquipoRepuesto`, `removeEquipoRepuesto`.
- **Hook**: extender `use-inventario`; `useEquipoRepuestos`.
- **Componentes**: agregar campos extendidos (+`MarcaSelect`) a `repuesto-form-sheet.tsx`; tab "Repuestos habituales" en la ficha de equipo.

---

## 5. FASE 3 — Plantillas de mantenimiento (+ items + checklist + asociación)

### DB
**`plantillas_mantenimiento`** `{id,tenantId,nombre,descripcion?,tipoEquipo?,frecuencia?,activo,metadata?(checklist en metadata.checklist:string[]),createdAt,updatedAt}`.
**`plantillas_mantenimiento_items`** `{id,tenantId,plantillaId,repuestoId,cantidad(>0),obligatorio(default true),observacion?}` (sin timestamps), único `(tenant,plantilla,repuesto)`.
**`equipos_plantillas_mantenimiento`** `{id,tenantId,equipoId,plantillaId,createdAt}`, único `(tenant,equipo,plantilla)`.

### Endpoints (`@Controller('plantillas-mantenimiento')`)
| Método + Path | Roles | Request | Respuesta |
|---|---|---|---|
| `GET /plantillas-mantenimiento` | admin, jefe, mech | query: `page?,limit?,search?(≤120),tipoEquipo?(≤80),includeInactive?` | **Paginado** `{...,itemsCount}` |
| `GET /plantillas-mantenimiento/:id` | admin, jefe, mech | — | Plantilla + `items:[{id,plantillaId,cantidad,obligatorio,observacion,repuesto:{id,codigo,nombre,unidad,activo,marcaId,stockDisponible}}]` |
| `POST /plantillas-mantenimiento` | admin, jefe | `nombre!(≤120),descripcion?(≤500),tipoEquipo?(≤80),frecuencia?(≤80),metadata?(checklist:string[]≤100, c/u ≤500)` | Plantilla |
| `PATCH /plantillas-mantenimiento/:id` | admin, jefe | `nombre?,descripcion?,tipoEquipo?,frecuencia?,activo?(reactivar),metadata?` | Plantilla |
| `PATCH /plantillas-mantenimiento/:id/desactivar` (200) | admin, jefe | — | Plantilla `activo:false` |
| `POST /plantillas-mantenimiento/:id/items` | admin, jefe | `repuestoId!(≤60),cantidad!(≥1),obligatorio?,observacion?(≤300)` | Ítem |
| `PATCH /plantillas-mantenimiento/:id/items/:itemId` | admin, jefe | `cantidad?(≥1),obligatorio?,observacion?(≤300)` | Ítem |
| `DELETE /plantillas-mantenimiento/:id/items/:itemId` (200) | admin, jefe | — | `{deleted:true,plantillaId,itemId}` |

Asociación equipo↔plantilla (`EquiposPlantillasController`, `@Controller('equipos')`):
| `GET /equipos/:equipoId/plantillas` | admin, jefe, mech | — | `[{id,equipoId,createdAt,plantilla:{id,nombre,descripcion,tipoEquipo,frecuencia,activo,itemsCount}}]` |
| `POST /equipos/:equipoId/plantillas/:plantillaId` | admin, jefe | — | Asociación (409 si inactiva/ya asociada) |
| `DELETE /equipos/:equipoId/plantillas/:plantillaId` (200) | admin, jefe | — | `{deleted:true,equipoId,plantillaId}` |

### Front (estado: **NO EXISTE**)
A construir:
- **API nuevo** `lib/api/plantillas.ts`: CRUD plantillas + items + asociación equipo-plantilla.
- **Hook nuevo** `hooks/use-plantillas.ts`.
- **Página nueva** `app/(app)/plantillas/page.tsx` (lista) + detalle/editor de items y checklist.
- **Componentes**: tabla; editor de items (selector repuesto + cantidad + obligatorio); editor de checklist (lista de pasos); tab "Plantillas aplicables" en ficha de equipo.
- **Menú**: entrada "Plantillas".

---

## 6. FASE 4 — Programaciones / Calendario

### DB — `programaciones_mantenimiento`
`{id,tenantId,equipoId,plantillaId?(SetNull),titulo,descripcion?,fechaProgramada,responsableId?(auth.users uuid),prioridad(default MEDIA),estado(default PROGRAMADA),recurrencia?,metadata?,createdAt,updatedAt}`. Índices por `(tenant,fechaProgramada)`, `(tenant,equipoId)`, `(tenant,estado)`.

### Endpoints (`@Controller('programaciones-mantenimiento')`)
| Método + Path | Roles | Request | Respuesta |
|---|---|---|---|
| `GET /programaciones-mantenimiento` | admin, jefe, mech | query: `page?,limit?,desde?,hasta?,equipoId?,estado?,responsableId?,plantillaId?` | **Paginado**. Item: modelo completo + `equipo:{id,codigo,nombre}` + `plantilla:{id,nombre}|null` |
| `GET /programaciones-mantenimiento/calendario` | admin, jefe, mech | query: `desde!,hasta!` (≤366 días) | **No paginado**. Eventos: `{id,title,start,estado,prioridad,equipo:{id,codigo,nombre},plantilla:{id,nombre}|null}` |
| `GET /programaciones-mantenimiento/:id` | admin, jefe, mech | — | Programación completa |
| `POST /programaciones-mantenimiento` | admin, jefe | `equipoId!,plantillaId?,titulo?(req si no hay plantilla),descripcion?,fechaProgramada!(no pasado),responsableId?(uuid),prioridad?,recurrencia?,metadata?` | Programación (409 si equipo/plantilla inactivos) |
| `PATCH /programaciones-mantenimiento/:id` | admin, jefe | solo si `estado=PROGRAMADA`: `titulo?,descripcion?,plantillaId?(null desvincula),fechaProgramada?,responsableId?,prioridad?,recurrencia?,metadata?` | Programación (409 si estado≠PROGRAMADA) |
| `PATCH /programaciones-mantenimiento/:id/cancelar` (200) | admin, jefe | — | Programación `estado:CANCELADA` |
| `POST /programaciones-mantenimiento/:id/generar-ot` | admin, jefe, **mech** | ver Fase 5 | ver Fase 5 |

### Front (estado: **NO EXISTE** — `mantenciones/page.tsx` es placeholder "Próximamente")
A construir:
- **API nuevo** `lib/api/programaciones.ts`: `getProgramaciones(filtros)`, `getCalendario(desde,hasta)`, `getProgramacion(id)`, `createProgramacion`, `updateProgramacion`, `cancelarProgramacion`, `generarOt`.
- **Hook nuevo** `hooks/use-programaciones.ts`.
- **Página**: reemplazar `mantenciones/page.tsx` con vista **calendario** (mes/semana) + lista + sheet crear/editar.
- **Componentes**: calendario (ej. lib liviana o grid propio); badges de estado + prioridad; form-sheet de programación (con `EquipoSelect`, selector de plantilla, selector de responsable desde usuarios); tab "Programaciones" en ficha de equipo.
- **Menú**: reusar la entrada "Mantenciones" existente.

---

## 7. FASE 5 — Generar OT desde programación

### Endpoint
`POST /programaciones-mantenimiento/:id/generar-ot` — roles admin, jefe, **mechanic**.
Request **GenerarOtDto**: `modoReserva?` `'AUTOMATICA'`(default)|`'SUGERIDA'`; `ajustarItems?: [{repuestoId!(≤60), cantidad!(≥0)}]` (0 excluye el insumo; requiere plantilla; el repuestoId debe estar en la plantilla); `observacion?(≤500)`.
Respuesta: `{ programacion (estado→GENERADA, con metadata.generacion: otId/otCodigo/ticketId/ticketCodigo/reservaId/generadoPorId/fecha), ot, ticket, reserva|null, itemsSugeridos? }` (itemsSugeridos solo si `modoReserva=SUGERIDA`). Flujo atómico OT→ticket→reserva. mechanic → reserva `SOLICITADA`; admin/jefe → `RESERVADA`. 409 si estado≠PROGRAMADA, equipo inactivo, o stock insuficiente (modo AUTOMATICA).

### Front (estado: **NO EXISTE**)
A construir:
- **API**: `generarOt(id, payload)` en `lib/api/programaciones.ts`.
- **Hook**: `useGenerarOt` (invalida queries de ordenes + programaciones).
- **Componente**: modal "Generar OT" desde el calendario/detalle de programación (elegir AUTOMATICA/SUGERIDA, ajustar cantidades de items, observación); al éxito redirigir a `ordenes/[id]`.

---

## 8. FASE 6 — Reportes (CSV/JSON), PDF de OT, Historial

### Endpoints de Reportes (`@Controller('reportes')`, roles **admin + jefe_taller**)
Base query: `formato?` `'json'`(default)|`'csv'`. JSON → `{data:rows[], total}`. CSV → archivo descargable (`text/csv`, attachment).
| Método + Path | Filtros extra | Filas (resumen) |
|---|---|---|
| `GET /reportes/equipos` | — | `{codigo,nombre,tipo,ubicacion,estadoOperativo,activo,totalOrdenes,ordenesAbiertas,ordenesCerradas,programacionesPendientes}` |
| `GET /reportes/equipos/:id/historial` | `desde?,hasta?,estado?` | JSON: objeto historial completo. CSV: timeline aplanado `{fecha,tipo,codigo,detalle,estado}` |
| `GET /reportes/ordenes` | `desde?,hasta?,estado?(OrdenTrabajoEstado)` | `{codigo,equipo,descripcion,prioridad,estado,tickets,fechaCreacion,fechaCierre}` (≤1000) |
| `GET /reportes/tickets` | `desde?,hasta?,estado?(TicketEstado),mecanicoId?` | `{codigo,titulo,estado,prioridad,ot,equipo,mecanico,fechaCreacion,fechaCierre}` (≤1000) |
| `GET /reportes/inventario` | `vista?` `'stock'`(default)|`'consumos'`, `soloCriticos?,equipoId?,desde?,hasta?` | stock: `{codigo,nombre,categoria,unidad,stockActual,stockReservado,stockDisponible,stockMinimo,critico,activo}`; consumos: `{codigo,nombre,unidad,unidadesConsumidas,movimientos}` |
| `GET /reportes/mantenimientos` | `vista?` `'todos'(default)|'vencidos'|'proximos'`, `desde?,hasta?,estado?` | `{titulo,equipo,plantilla,fechaProgramada,estado,prioridad,recurrencia}` (+`diasAtraso` en vencidos) |

### PDF de OT (`@Controller('ordenes')`)
`GET /ordenes/:id/pdf` — admin, jefe, mech. Devuelve **StreamableFile** (`application/pdf`, `inline`). Ficha imprimible de la OT con tickets, reservas, consumos, evidencias y firmas.

### Front (estado: **NO EXISTE**)
A construir:
- **API nuevo** `lib/api/reportes.ts`: wrappers de los 6 reportes con `formato` + filtros; helper `descargarCsv(response, filename)` (blob, no json).
- **API**: `descargarPdfOrden(id)` en `lib/api/ordenes.ts` (blob `application/pdf` → abrir/descargar).
- **Página nueva** `app/(app)/reportes/page.tsx`: selector de tipo + panel de filtros por tipo + botón "Descargar CSV"/"Ver JSON".
- **Componente**: botón "Descargar PDF" en `ordenes/[id]`. Botón "Historial CSV" en ficha de equipo.
- **Menú**: entrada "Reportes" (Administración).

---

## 9. Checklist consolidada de construcción Front

**API wrappers — nuevos:** `lib/api/marcas.ts`, `plantillas.ts`, `programaciones.ts`, `reportes.ts`.
**API wrappers — extender:** `equipos.ts` (campos nuevos + resumen/historial/qr/repuestos/plantillas), `inventario.ts` (repuesto extendido: marcaId/codigoFabricante/ubicacionBodega/proveedor), `ordenes.ts` (PDF).

**Hooks — nuevos:** `use-marcas`, `use-plantillas`, `use-programaciones`.
**Hooks — extender:** `use-equipos` (resumen/historial/qr/repuestos/plantillas), `use-inventario`.

**Páginas — nuevas:** `equipos/[id]` (ficha con tabs), `marcas`, `plantillas` (+detalle), `reportes`.
**Páginas — conectar/editar:** `mantenciones` (→ calendario de programaciones), `ordenes/[id]` (botón PDF), tabla de `equipos` (filas navegables a la ficha).

**Componentes — nuevos:** ficha de equipo (resumen+alertas, timeline historial, QR, badge estadoOperativo), `MarcaSelect`, tabla+form de marcas, editor de plantillas (items + checklist), calendario + form de programaciones, modal generar-OT, panel de reportes/descargas, botón PDF de OT, campos extendidos en repuesto-form.

**Menú (`components/layout/data/sidebar-data.ts`):** agregar Marcas, Plantillas, Reportes; reusar Mantenciones para el calendario.

---

## 10. Orden de implementación sugerido (minimiza dependencias)

1. **Marcas** (catálogo base, lo usan equipos y repuestos) → `MarcaSelect`.
2. **Equipo ficha central** (`equipos/[id]`: resumen + historial + QR + estadoOperativo) — alto valor, núcleo de las fases.
3. **Repuestos extendidos + asociación equipo-repuesto** (depende de Marcas).
4. **Plantillas** (items + checklist + asociación equipo-plantilla; depende de repuestos).
5. **Programaciones / Calendario** (depende de equipos y plantillas).
6. **Generar OT** (depende de programaciones).
7. **Reportes CSV + PDF de OT** (transversal, al final).

> Cada bloque: API wrapper → hook → página/componentes → entrada de menú → verificar contra el endpoint real (roles, shape, paginación).
