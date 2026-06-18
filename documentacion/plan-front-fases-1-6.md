# Plan de implementación Front — Fases 1-6 (gitflow)

> **Objetivo:** llevar al frontend (`producto/tract-front`) las features fases 1-6 ya mergeadas y desplegadas en el backend (`producto/trackt-api`). Producto **funcional**, no stubs. Cada bloque sigue gitflow: **una rama = un ticket de Linear = un PR**, nacidas de `main`.
>
> Fuente de contrato: este plan usa los **shapes reales** del backend (verificados leyendo controllers+services+DTOs), que corrigen el doc `fases-1-6-backend-mapa-y-plan-front.md` en un punto crítico (ver §1). Bugs bloqueantes detectados en `revision-bugs-endpoints.md` → **Fase 0**.
>
> Rama base: `main` @ `8a347ca`.

---

## 1. Contrato y convenciones (aplican a TODO el front nuevo)

### Gitflow (documentacion/gitflow.md)
- **Rama:** `<tipo>/<TRA-ID>-<descripcion-kebab>` (ej. `feat/TRA-40-marcas-abm`). El ID de Linear es obligatorio.
- **Commit:** `<tipo>(<scope>): <mensaje> (TRA-ID)`; scope `front` aquí.
- **PR:** uno por ticket; validar `npm run lint && npm run build` antes de abrir.
- Ramas nacen de `main`. Las dependencias entre tickets (§4) marcan el orden de merge.

### Contrato de datos (CRÍTICO)
- **Envelope paginado real (anidado):** `{ data: T[], meta: { page, limit, total, totalPages } }`. Leer `result.data` y, si se pagina, `result.meta.totalPages`. **No** existe `result.total` plano. Patrón a copiar: `inventario.ts` (`type Paginated<T> = { data, meta }`) y `tickets.ts` (`getAllTickets` itera `meta.totalPages`).
- **`@Max(100)` en `limit`:** nunca pedir `limit>100` (rompe con 400). Para traer "todo", iterar páginas de 100.
- **Listados NO paginados (array plano):** repuestos/plantillas asociados a equipo, reservas, carga-mecánicos, `calendario`, reportes JSON (`{data,total}`). Consumir directo.
- **Auth/Tenant:** todo va detrás de `AuthGuard+RolesGuard`. Usar SIEMPRE `authFetch` (adjunta Bearer, retry 401). **Nunca** mandar `tenant_id`.
- **Roles:** `admin`, `jefe_taller`, `mechanic`. Escritura de **Marcas = solo admin**; resto de tablas nuevas admiten `admin`+`jefe_taller`.
- **Descargas (CSV/PDF):** `await response.blob()` + `URL.createObjectURL` + `<a download>` / abrir pestaña. **Nunca** `.json()`. `authFetch` devuelve `Response` cruda, sirve igual.
- **`responsableId` (programaciones):** UUID de `auth.users`, **sin join**. Cruzar con `lib/api/usuarios.ts` para mostrar nombre.
- **`metadata.checklist`:** `string[]` (≤100 pasos, ≤500 chars c/u). Normalización: `codigo` de equipo en TRIM+UPPERCASE.
- **Reactivar:** Equipos tiene endpoint dedicado; **Marcas y Plantillas** se reactivan con `PATCH .../:id` enviando `{ activo: true }`.

---

## 2. Tabla maestra de tickets

> TRA-IDs **propuestos** (confirmar/crear en Linear). 12 tickets agrupados en 8 fases.

| # | Ticket (TRA) | Rama | Scope | Depende de |
|---|---|---|---|---|
| F0 | TRA-XX — Fix obtención de datos (paginación) | `fix/TRA-XX-front-data-loading` | front | — |
| F1 | TRA-XX — Catálogo de Marcas (ABM + `MarcaSelect`) | `feat/TRA-XX-marcas-abm` | front | F0 |
| F2 | TRA-XX — Ficha de equipo (detalle, resumen, alertas) | `feat/TRA-XX-equipo-ficha` | front | F0 |
| F2b | TRA-XX — Equipo: QR + historial | `feat/TRA-XX-equipo-qr-historial` | front | F2 |
| F3 | TRA-XX — Repuestos extendidos + asociación equipo↔repuesto | `feat/TRA-XX-repuestos-extendidos` | front | F1 (+ corrige BUG-3) |
| F4 | TRA-XX — Plantillas de mantenimiento (CRUD + items + checklist) | `feat/TRA-XX-plantillas` | front | F3 |
| F4b | TRA-XX — Asociación equipo↔plantilla (tabs en ficha) | `feat/TRA-XX-equipo-plantillas` | front | F2, F4 |
| F5 | TRA-XX — Programaciones + calendario | `feat/TRA-XX-programaciones-calendario` | front | F2, F4 |
| F6 | TRA-XX — Generar OT desde programación | `feat/TRA-XX-generar-ot` | front | F5 |
| F7 | TRA-XX — Reportes (CSV/JSON) | `feat/TRA-XX-reportes` | front | F0 |
| F7b | TRA-XX — PDF de OT (botón en detalle) | `feat/TRA-XX-orden-pdf` | front | — |
| F8 | TRA-XX — Menú/sidebar: Marcas, Plantillas, Reportes | `feat/TRA-XX-sidebar-fases-1-6` | front | F1, F4, F7 |

> F7b y F8 pueden plegarse en sus fases vecinas si se prefiere menos PRs. F8 puede ir incremental dentro de cada feature (añadir su entrada de menú en el mismo PR) — recomendado para no bloquear.

---

## 3. Detalle por ticket

### F0 — Fix obtención de datos (bloqueante) · `fix/TRA-XX-front-data-loading`
**Qué:** BUG-1, BUG-2, BUG-4 de `revision-bugs-endpoints.md`.
- `lib/api/equipos.ts`: `EQUIPOS_PAGE_LIMIT = 100`.
- `lib/api/inventario.ts:206`: `limit=100`.
- `lib/api/ordenes.ts`: paginar `getOrdenes` iterando `meta.totalPages` (código en doc de bugs).
**Aceptación:** lista equipos, `EquipoSelect`, `/inventario`, selectores de repuesto y listado de OT cargan; conteos de summary OT coinciden con el total real (>10 OTs).

---

### F1 — Catálogo de Marcas · `feat/TRA-XX-marcas-abm`
**Backend:** `@Controller('marcas')`. `GET /marcas` (todos los roles, paginado `{data,meta}`); `POST`/`PATCH /:id`/`PATCH /:id/desactivar` (**solo admin**). Filtro `tipo`: `EQUIPO`→{EQUIPO,AMBOS}, `REPUESTO`→{REPUESTO,AMBOS}. Reactivar con `PATCH /:id {activo:true}`. Dup `(nombre,tipo)` case-insensitive → 409.
**Construir:**
- `lib/api/marcas.ts`: `type Marca = { id, nombre, tipo:'EQUIPO'|'REPUESTO'|'AMBOS', activo, metadata, createdAt, updatedAt }`; `getMarcas(filtros)` (desempaqueta `result.data`), `createMarca`, `updateMarca`, `desactivarMarca`, `reactivarMarca`(→PATCH activo:true).
- `hooks/use-marcas.ts`: `useMarcas(filtros)` + mutations con invalidación.
- `app/(app)/marcas/page.tsx` + `marcas-client.tsx`: tabla, búsqueda, filtro por tipo, toggle inactivas, sheet crear/editar; **escritura solo visible a admin** (`requireRole`).
- `components/marcas/marca-select.tsx`: combobox reutilizable (prop `tipo`), llama `getMarcas({tipo})`. Reemplaza el `<Input>` de texto libre `marca` en `equipo-form-sheet.tsx`.
**Aceptación:** admin crea/edita/desactiva/reactiva marcas; `jefe_taller`/`mechanic` solo leen; `MarcaSelect` funciona en el form de equipo.

---

### F2 — Ficha de equipo (detalle + resumen) · `feat/TRA-XX-equipo-ficha`
**Backend:** `GET /equipos/:id` (DETAIL_SELECT), `GET /equipos/:id/resumen` (`{equipo, estadisticas, ultimasOrdenes[≤5], ultimosTickets[≤5], proximasProgramaciones[≤5], alertas[]}`; alertas `EQUIPO_INACTIVO|FUERA_DE_SERVICIO|EN_MANTENIMIENTO|OT_PRIORIDAD_ALTA`). `PATCH`/`desactivar`/`reactivar` (admin).
**Construir:**
- `lib/api/equipos.ts`: **extender** `type Equipo` con `estadoOperativo, tipo, numeroSerie, fechaInstalacion, fechaCompra, qrToken, metadata, createdAt, updatedAt`; `getEquipo(id)`, `getEquipoResumen(id)`; extender Create/Update payloads (`tipo, numeroSerie, estadoOperativo, fechas, metadata`).
- `hooks/use-equipos.ts`: `useEquipo(id)`, `useEquipoResumen(id)`.
- `app/(app)/equipos/[id]/page.tsx` + client: ficha con tabs (Resumen | Historial | Repuestos | Plantillas | Programaciones — las últimas se rellenan en F2b/F3/F4b/F5). Tab Resumen: cards de estadísticas, panel de alertas, últimas OTs/tickets, próximas programaciones.
- `components/equipos/status-badge.tsx`: badge para `estadoOperativo` (3 valores).
- Hacer **navegables** las filas de la tabla actual (`equipos-client.tsx` → `equipos/[id]`).
- `equipo-form-sheet.tsx`: añadir `estadoOperativo` (select), `tipo`, `numeroSerie`, `fechaInstalacion`, `fechaCompra`; cambiar `marca` por `MarcaSelect(tipo=EQUIPO)`.
**Aceptación:** clic en una fila abre la ficha con datos reales y alertas; admin edita los campos nuevos.

### F2b — QR + historial · `feat/TRA-XX-equipo-qr-historial`
**Backend:** `POST /equipos/:id/qr` (admin, regenera), `GET /equipos/qr/:qrToken` (resuelve), `GET /equipos/:id/historial` (filtros `desde/hasta/estado`; devuelve ordenes/tickets/evidencias/reservas/movimientos/repuestosConsumidos/programaciones).
**Construir:**
- `lib/api/equipos.ts`: `generarQr(id)`, `getEquipoByQr(token)`, `getEquipoHistorial(id, filtros)`.
- `hooks/use-equipos.ts`: `useGenerarQr`, `useEquipoHistorial`.
- Modal QR: renderizar el `qrToken` como imagen (lib `qrcode.react`); botón "Regenerar" (admin) con confirmación (invalida QR previos).
- Tab Historial: timeline con filtros desde/hasta/estado; manejar `null` (plantilla, repuesto sin nombre).
- (Opcional aquí o en F7) ruta pública/escáner que resuelva `GET /equipos/qr/:token`.
**Aceptación:** se genera/visualiza el QR; el historial filtra y muestra eventos reales.

---

### F3 — Repuestos extendidos + asociación equipo↔repuesto · `feat/TRA-XX-repuestos-extendidos`
**Incluye BUG-3.** **Backend:** `mapRepuesto` ya devuelve `marca/marcaId/codigoFabricante/ubicacionBodega/proveedor`. `GET/POST/DELETE /equipos/:id/repuestos` (array plano; POST/DELETE admin+jefe). `GET /inventario/repuestos` ya filtra por `marcaId`.
**Construir:**
- `lib/api/inventario.ts`: extender `type Repuesto` (+`marca,marcaId,codigoFabricante,ubicacionBodega,proveedor`) y payloads (ver BUG-3); `RepuestosFilters` + `marcaId`.
- `repuesto-form-sheet.tsx`: campos `codigoFabricante/ubicacionBodega/proveedor` + `MarcaSelect(tipo=REPUESTO)`.
- `repuesto-detalle-client.tsx`: mostrar los campos nuevos.
- `lib/api/equipos.ts`: `getEquipoRepuestos(id)`, `addEquipoRepuesto(id, {repuestoId,cantidadRef?,observacion?})`, `removeEquipoRepuesto(id, repuestoId)`.
- `hooks/use-equipos.ts`: `useEquipoRepuestos(id)` + mutations.
- Tab **"Repuestos habituales"** en la ficha de equipo: tabla (repuesto, `stockDisponible`, `cantidadRef`, observación) + agregar/quitar.
- (Opcional) filtro por marca en la lista de inventario.
**Aceptación:** repuesto muestra/edita marca y campos extendidos; se asocian/desasocian repuestos a un equipo. CHECK `cantidadRef` = NULL o >0.

---

### F4 — Plantillas de mantenimiento · `feat/TRA-XX-plantillas`
**Backend:** `@Controller('plantillas-mantenimiento')` (lectura todos; escritura admin+jefe). Lista paginada con `itemsCount`; detalle con `items[]` (repuesto embebido + `stockDisponible`); checklist en `metadata.checklist`. Items: `POST/PATCH/DELETE /:id/items[/:itemId]` (CHECK `cantidad>0`). Reactivar con `PATCH /:id {activo:true}`.
**Construir:**
- `lib/api/plantillas.ts`: `type Paginated<T>={data,meta}`; `PlantillaListItem`(+`itemsCount`), `PlantillaDetalle`(+`items[]`), `PlantillaItem`(repuesto+stockDisponible). CRUD + items (`addItem/updateItem/removeItem`).
- `hooks/use-plantillas.ts`: lista/detalle/CRUD/items con invalidación.
- `app/(app)/plantillas/page.tsx` (lista: itemsCount, tipoEquipo, frecuencia, activo) + detalle/editor.
- Editor de items (selector repuesto mostrando `stockDisponible` + cantidad + obligatorio + observación) y editor de checklist (lista de pasos; validar ≤100/≤500 para evitar 400).
**Aceptación:** CRUD de plantillas, items y checklist; nulls (`descripcion/tipoEquipo/frecuencia/observacion/marcaId`) renderizan sin romper.

### F4b — Asociación equipo↔plantilla · `feat/TRA-XX-equipo-plantillas`
**Backend:** `GET/POST/DELETE /equipos/:equipoId/plantillas[/:plantillaId]` (array plano; escritura admin+jefe; 409 si inactiva/ya asociada).
**Construir:** `lib/api/equipos.ts` `getEquipoPlantillas/addEquipoPlantilla/removeEquipoPlantilla`; hook; tab **"Plantillas aplicables"** en la ficha de equipo.
**Aceptación:** asociar/desasociar plantillas a un equipo desde la ficha.

---

### F5 — Programaciones + calendario · `feat/TRA-XX-programaciones-calendario`
**Backend:** `@Controller('programaciones-mantenimiento')` (lectura todos; create/update/cancelar admin+jefe). Lista paginada `{data,meta}` con `equipo:{id,codigo,nombre}`+`plantilla:{id,nombre}|null`. `GET /calendario?desde&hasta` (**obligatorios, ≤366 días, array plano**, eventos `{id,title,start,estado,prioridad,equipo,plantilla}`). PATCH solo si `estado=PROGRAMADA`. `responsableId` = UUID sin join.
**Construir:**
- `lib/api/programaciones.ts`: `getProgramaciones(filtros)` (envelope), `getCalendario(desde,hasta)` (array plano, campos `title/start`), `getProgramacion(id)`, `createProgramacion`, `updateProgramacion`, `cancelarProgramacion`. Tipos con estado de 5 valores.
- `hooks/use-programaciones.ts`.
- **Reemplazar** `app/(app)/mantenciones/page.tsx` (hoy placeholder): vista calendario (mes/semana) + lista + sheet crear/editar. Cruzar `responsableId` con `usuarios` para el nombre; manejar `responsableId/plantilla = null`.
- `components/programaciones/`: calendario (grid propio o lib liviana), badges estado+prioridad, form-sheet (`EquipoSelect`, selector de plantilla, selector de responsable desde usuarios).
- Tab "Programaciones" en la ficha de equipo.
- Resolver roles del sidebar (ver §5).
**Aceptación:** calendario carga eventos del rango; CRUD de programación; PATCH bloqueado si no está `PROGRAMADA` (manejar 409).

---

### F6 — Generar OT desde programación · `feat/TRA-XX-generar-ot`
**Backend:** `POST /programaciones-mantenimiento/:id/generar-ot` (admin, jefe, **mechanic**). Body `{ modoReserva?:'AUTOMATICA'|'SUGERIDA', ajustarItems?:[{repuestoId,cantidad≥0}], observacion? }`. Respuesta `{ programacion(→GENERADA), ot, ticket, reserva|null, itemsSugeridos? }`. `mechanic`→reserva `SOLICITADA`; admin/jefe→`RESERVADA`. 409 si estado≠PROGRAMADA / equipo inactivo / stock insuficiente (AUTOMATICA) con `{message, faltantes[]}`.
**Construir:**
- `lib/api/programaciones.ts`: `generarOt(id, payload)`.
- `hooks/use-programaciones.ts`: `useGenerarOt` (invalida `ordenes` + `programaciones`).
- Modal "Generar OT" desde calendario/detalle: elegir AUTOMATICA/SUGERIDA, ajustar cantidades de items (0 excluye; requiere plantilla), observación. Manejar 409 de faltantes. `itemsSugeridos` solo en SUGERIDA; `reserva` puede ser null. Al éxito → redirigir a `ordenes/[id]`.
**Aceptación:** generar OT crea OT+ticket(+reserva) y deja la programación `GENERADA`; errores de stock se muestran legibles.

---

### F7 — Reportes (CSV/JSON) · `feat/TRA-XX-reportes`
**Backend:** `@Controller('reportes')` (**solo admin+jefe_taller**). 6 reportes: `equipos`, `equipos/:id/historial`, `ordenes`, `tickets`, `inventario` (`vista=stock|consumos`), `mantenimientos` (`vista=todos|vencidos|proximos`). `formato=json|csv`. JSON → `{data:rows,total}` (historial = objeto crudo). CSV → `text/csv` attachment.
**Construir:**
- `lib/api/reportes.ts`: wrappers de los 6 (querystring `formato/desde/hasta/estado/vista/soloCriticos/equipoId/mecanicoId`). JSON → `res.json()` (desempaquetar `.data`; historial distinto). `descargarCsv(path, params)` → `res.blob()` + `<a download>` (nunca `.json()`).
- `hooks/use-reportes.ts` para las vistas JSON.
- `app/(app)/reportes/page.tsx`: selector de tipo + panel de filtros por tipo + "Ver (tabla JSON)" / "Descargar CSV". Solo admin+jefe (`requireRole`).
- Botón "Historial CSV" en la ficha de equipo (reusa `descargarCsv`).
**Aceptación:** cada reporte muestra tabla y descarga CSV correctamente (con BOM/encoding del backend).

### F7b — PDF de OT · `feat/TRA-XX-orden-pdf`
**Backend:** `GET /ordenes/:id/pdf` (admin, jefe, mech) → StreamableFile `application/pdf` inline.
**Construir:** `lib/api/ordenes.ts` `descargarPdfOrden(id)` (`res.blob()` → abrir pestaña/descargar); botón "Descargar PDF" en `ordenes/[id]/orden-detalle-client.tsx`.
**Aceptación:** el botón abre/descarga el PDF de la OT.

---

### F8 — Menú/sidebar · `feat/TRA-XX-sidebar-fases-1-6`
**Construir:** en `components/layout/data/sidebar-data.ts` añadir **Marcas** y **Reportes** (Administración, roles admin/jefe), **Plantillas** (General o Mantenciones), y reusar **Mantenciones** para el calendario. Decidir roles de Mantenciones (ver §5).
> Alternativa recomendada: añadir cada entrada **dentro del PR de su feature** (F1/F4/F5/F7) y omitir F8.

---

## 4. Orden de implementación y dependencias

```
F0 (fix data-loading)  ─┬─────────────────────────────────────────────┐
                        │                                             │
   F1 Marcas ──► MarcaSelect                                          │
       │                                                             │
       ├──► F3 Repuestos extendidos (incluye BUG-3)                  │
       │           │                                                 │
       │           └──► F4 Plantillas ──► F4b Equipo↔Plantilla       │
       │                      │                                      │
   F2 Ficha equipo ──► F2b QR+historial                             │
       │                      │                                      │
       └──────────────► F5 Programaciones+Calendario ──► F6 Generar OT
                                                                      │
                                          F7 Reportes ◄──────────────┘
                                          F7b PDF de OT (independiente)
                                          F8 Sidebar (o incremental)
```

**Secuencia sugerida de merge:** F0 → F1 → F2 → F2b → F3 → F4 → F4b → F5 → F6 → F7 → F7b → (F8). F7b y F1 pueden adelantarse en paralelo (sin dependencias fuertes).

---

## 5. Decisiones de producto a confirmar
1. **Roles de Mantenciones/Programaciones:** ¿el mecánico ve el calendario (el backend se lo permite) o queda admin/jefe? Afecta `sidebar-data.ts` y `generar-ot` desde mecánico.
2. **Ruta duplicada** `(app)/ordenes` vs `(app)/ordenes-trabajo`: confirmar la vigente y eliminar la otra.
3. **Lib de QR** (`qrcode.react` u otra) y **lib de calendario** (grid propio vs dependencia liviana).
4. **Paginación UI:** ¿se entrega paginación real en equipos/inventario/ordenes en estas fases o se difiere? (los fixes F0 desbloquean sin UI de páginas).

---

## 6. Checklist global de construcción

**Wrappers API — nuevos:** `marcas.ts`, `plantillas.ts`, `programaciones.ts`, `reportes.ts`.
**Wrappers API — extender:** `equipos.ts` (campos + resumen/historial/qr/repuestos/plantillas), `inventario.ts` (repuesto extendido), `ordenes.ts` (paginación + PDF).
**Hooks — nuevos:** `use-marcas`, `use-plantillas`, `use-programaciones`, `use-reportes`.
**Hooks — extender:** `use-equipos`, `use-inventario`.
**Páginas — nuevas:** `equipos/[id]`, `marcas`, `plantillas` (+detalle), `reportes`.
**Páginas — conectar/editar:** `mantenciones` (→calendario), `ordenes/[id]` (PDF), filas de `equipos` navegables.
**Componentes — nuevos:** ficha equipo (resumen+alertas, timeline, QR, `StatusBadge`), `MarcaSelect`, tabla+form marcas, editor plantillas (items+checklist), calendario+form programaciones, modal generar-OT, panel reportes/descargas, botón PDF OT, campos extendidos en `repuesto-form`.
**Menú:** Marcas, Plantillas, Reportes; reusar Mantenciones.

> Cada bloque: wrapper API → hook → página/componentes → entrada de menú → **verificar contra el endpoint real** (roles, shape `{data,meta}`, paginación). Validación previa a PR: `npm run lint && npm run build`.
