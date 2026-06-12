# Revisión de los 8 PRs abiertos — 2026-06-12

Revisión multi-agente (un revisor por PR + chequeo de conflictos cruzados). Hallazgo estructural clave: **los PRs #48–#52 son un stack** (`fase-1 ⊂ fase-2 ⊂ fase-3 ⊂ fase-4 ⊂ fase-5`); la rama `fase-5-generar-ot` contiene todo el código de las fases 1–4. Cada fase se revisó por su diff incremental para no duplicar.

**No se encontraron bugs críticos ni altos.** Sin fugas de tenant, sin endpoints sin guards, sin estados rotos. Los hallazgos son de severidad media/baja.

---

## Mapa de PRs

| PR | Rama | Alcance | Bugs |
|---|---|---|---|
| #48 | fase-1-equipos | Backend: equipo como ficha central (QR, resumen, estadoOperativo) | 1 media, 2 bajas |
| #49 | fase-2-catalogos | Backend: módulo marcas + equipos_repuestos + repuesto extendido | 1 media, 2 bajas |
| #50 | fase-3-plantillas | Backend: plantillas de mantenimiento + asociación equipo↔plantilla | 3 bajas |
| #51 | fase-4-calendario | Backend: programaciones de mantenimiento + calendario | 2 medias, 1 baja |
| #52 | fase-5-generar-ot | Backend: generar OT+ticket+reserva desde programación (tx única) | 1 media, 3 bajas |
| #53 | fix/TRA-37 badges | Front: 1 archivo (globals.css), badges modo claro | 0 |
| #44 | style/TRA-35 login | Front: refactor visual login/forgot + AuthShell | 1 media, 1 baja |
| #43 | jaimegosoriou-evidencia | PNG 5,2 MB en documentacion/ | 1 media, 2 bajas |

---

## PR #48 — Fase 1: equipos como ficha central

**Qué hace:** amplía `Equipo` (tipo, numeroSerie, `estadoOperativo` enum nuevo, fechas, `qrToken` único) con migración SQL idempotente. Endpoints nuevos: `POST /equipos/:id/qr` (solo admin), `GET /equipos/qr/:qrToken`, `GET /equipos/:id/resumen` (stats, últimas 5 OTs/tickets, alertas). Normalización de textos en create/update (código trim+uppercase). 14 tests nuevos. Tenant scoping correcto en todo, incluidas queries ticket→ot→equipo.

### Bugs
1. **[media] Códigos legacy sin normalizar** — `supabase/migrations/20260610000000_equipos_ficha.sql`. El anti-duplicado normaliza a mayúsculas, pero no hay backfill `UPDATE equipos SET codigo = UPPER(TRIM(codigo))`. Un equipo legacy `eq-100` permite crear `EQ-100` (el check y la unique constraint son case-sensitive). Fix: backfill en migración con detección previa de colisiones, o documentar que solo aplica a datos nuevos.
2. **[baja] Carrera dup-check → create da 500 en vez de 409** — `equipos.service.ts:176`. P2002 no se traduce a ConflictException. Deuda heredada de main, pero era el momento de cerrarla.
3. **[baja] Índice `(tenant_id, estado_operativo)` sin consumidor** — `ListEquiposQueryDto` no expone filtro por estadoOperativo. Agregar filtro o quitar índice.

### Mejoras
- `normOptional`/`normNullable` funcionalmente idénticas → unificar.
- `desactivar()` no toca `estadoOperativo`: puede quedar `activo=false` + `OPERATIVO`. Definir semántica.
- Escrituras `where:{id}` tras verificar tenant con findFirst (TOCTOU heredado) → `updateMany({where:{id,tenantId}})`.
- Check de enum en migración sin filtro por schema (`pg_namespace`).

---

## PR #49 — Fase 2: catálogos

**Qué hace (delta vs fase-1):** módulo `marcas` (CRUD por tenant, enum `MarcaTipo` EQUIPO/REPUESTO/AMBOS, baja lógica), tabla `equipos_repuestos` (repuestos habituales por equipo con stock disponible), `Repuesto` extendido (marcaId FK SetNull, codigoFabricante, ubicacionBodega, proveedor). Migración con RLS para ambas tablas. Tests para marcas, equipos-repuestos e inventario.

### Bugs
1. **[media] Dup-check de marcas ignora solapamiento de AMBOS** — `marcas.service.ts:152-165`. Se puede crear "CAT" tipo EQUIPO y "CAT" tipo AMBOS; como `findAll` con tipo=EQUIPO devuelve `{in:[EQUIPO,AMBOS]}`, el formulario muestra dos "CAT" — justo el duplicado que el check quiere evitar. Fix: dup-check con `tipo:{in:[tipo,AMBOS]}` (y AMBOS contra cualquier tipo).
2. **[baja] `marcaId: ''` esquiva `assertMarcaUsable`** — DTOs sin `@IsNotEmpty`; `if (dto.marcaId)` es falsy con `''` → FK P2003 → 400 genérico en vez de 404 claro.
3. **[baja] Cambiar marca a tipo EQUIPO no valida repuestos que la referencian** — deja repuestos vinculados a una marca de ámbito EQUIPO, estado que `assertMarcaUsable` rechaza para asignaciones nuevas. Validar con count + 409, o documentar.

### Mejoras
- `includeInactive` en marcas visible para mechanic (inventario lo restringe) → alinear patrón.
- Transformación booleana de `includeInactive` copiada inline → extraer helper a `common/`.
- `assertMarcaUsable` fuera de la tx en createRepuesto.

---

## PR #50 — Fase 3: plantillas

**Qué hace (delta vs fase-2):** 3 modelos nuevos (PlantillaMantenimiento, items con repuesto, asociación equipo↔plantilla), CRUD en `/plantillas-mantenimiento` + `/equipos/:equipoId/plantillas`, checklist en `metadata.checklist` (máx 100 pasos × 500 chars), migración con RLS. 694 líneas de tests. Replica fielmente los patrones de fase-2.

### Bugs (todos baja)
1. **TOCTOU al asociar plantilla/repuesto**: check `activo` + create sin tx (misma ventana que fase-2; Fase 4 re-valida, impacto bajo).
2. **`observacion` de items no normaliza `''`→null** ni permite limpiar — inconsistente con `update()` del mismo service.
3. **`UpdatePlantillaDto.metadata` rechaza null** — no se puede limpiar metadata salvo enviando `{}`.

### Mejoras
- Filtro `tipoEquipo` excluye plantillas genéricas (tipoEquipo NULL) → considerar `OR null`.
- Bloque "validar tenant + activo + dup + create P2002" triplicado → helper común.
- Transform de `includeInactive` copiado en 3 DTOs → decorador `@ToBoolean()` compartido.
- `plantillas_mantenimiento_items` sin `created_at` (equipos_repuestos sí lo tiene).

---

## PR #51 — Fase 4: calendario

**Qué hace (delta vs fase-3):** módulo `programaciones-mantenimiento` (modelo + enum estado, migración con RLS). Endpoints: lista paginada con filtros, `GET /calendario` (rango obligatorio máx 366 días), detalle, POST, PATCH (solo estado PROGRAMADA), cancelar con guard anti-TOCTOU. Completa `proximasProgramaciones` en el resumen de equipo. 482 líneas de tests.

### Bugs
1. **[media] `UpdateProgramacionDto.responsableId` sin `@IsUUID` → 500** — `update-programacion.dto.ts:171-175`. `requireResponsable` interpola en `$queryRaw` con cast `::uuid`; un string no-UUID pasa el DTO y revienta en Postgres. El propio repo documenta este riesgo en asignar-ticket.dto.ts. **Fix directo:** `@ValidateIf((_, v) => v !== null) + @IsUUID()`.
2. **[media] PATCH /:id sin guard anti-TOCTOU** — `programaciones-mantenimiento.service.ts` (update). findFirst verifica PROGRAMADA y luego `update({where:{id}})` incondicional: una cancelación concurrente (o GENERADA en Fase 5) recibe igualmente la edición. `cancelar()` del mismo archivo usa el patrón correcto. **Fix:** `updateMany({where:{id,tenantId,estado:PROGRAMADA}})`, count 0 → 409.
3. **[baja] Filtro `hasta` documentado inclusivo pero excluye casi todo el último día** — `hasta=2026-06-30` se parsea como T00:00:00Z con `lte`; eventos del último día del mes desaparecen del calendario. Fix: fecha sin hora → fin de día (`lt` de hasta+1d).

### Mejoras
- Cálculo "inicio de día UTC" duplicado en 2 archivos → helper común.
- Contrato de "limpiar campo con null" inconsistente entre campos del PATCH.
- Filtro `responsableId` sin índice `(tenant_id, responsable_id)`.

---

## PR #52 — Fase 5: generar OT

**Qué hace (delta vs fase-4):** `POST /programaciones-mantenimiento/:id/generar-ot` — en una transacción interactiva: programación PROGRAMADA→GENERADA (guard anti doble generación), crea OT, crea ticket, OT PENDIENTE→EN_PROCESO, y opcionalmente reserva insumos de la plantilla (modos AUTOMATICA/SUGERIDA, `ajustarItems`). Extrae `crearEnTx`/`crearReservaEnTx` de ordenes/tickets/inventario sin cambiar contratos de endpoints. El 409 de stock insuficiente pasa a payload estructurado `{message, faltantes[]}`. 13 tests. Orden de locks consistente entre flujos (positivo: evita deadlocks).

### Bugs
1. **[media] Flujo muerto para mechanic** — el endpoint permite role mechanic, pero el ticket se crea con `jefeId=userId` y `mecanicoId=null`: (a) el mechanic no ve el ticket que generó (findAll fuerza mecanicoId=user.id); (b) en modo SUGERIDA, crear la reserva después da 403 (`assertCanActOnTicket` con mecanicoId=null) — callejón sin salida; (c) jefeId queda con id de un mechanic. **Fix:** asignar `mecanicoId=user.id` cuando genera un mechanic, o restringir el endpoint/SUGERIDA a admin/jefe_taller.
2. **[baja] `ajustarItems` permite excluir items `obligatorio=true`** con cantidad 0, sin validación. Decidir: 400 o eliminar el campo del flujo.
3. **[baja] Metadata de programación: read-modify-write con lectura pre-tx** — PATCH concurrente de metadata se pierde. Releer dentro de la tx.
4. **[baja] `ajustarItems` con repuestoId duplicado: last-write-wins silencioso** — rechazar duplicados con 400.

### Mejoras
- Diff inflado con ~15 hunks de reformateo prettier-only en inventario.service.ts mezclado con lógica.
- Transición OT PENDIENTE→EN_PROCESO duplicada con tickets.service.ts → helper único.
- `observacion` ignorada en modo SUGERIDA sin documentar.
- Considerar timeout explícito en la `$transaction` (3 advisory locks + ~10 queries, default 5s).

### ⚠️ Cambio de contrato observable
El 409 de stock en `POST /tickets/:id/reservas-repuestos` (endpoint existente) cambia de message string a `{message, faltantes[]}`. Revisar si el frontend parsea ese string.

---

## PR #53 — fix badges modo claro (TRA-37)

**Qué hace:** 1 archivo (`globals.css`). En main, `:root` y `.dark` tenían la misma paleta oscura; el PR pone paleta clara en `:root` (Tailwind 50/200/700) y deja `.dark` intacto. Estructura correcta, consumidores verificados (StatusBadge, ESTADO_DOT), **sin bugs**.

### Mejoras
- Código muerto: tokens `--ticket-*` y sus 12 mapeos `@theme` no tienen ningún consumidor → eliminables.
- `--ticket-*` duplica `--estado-*-bg/text` → si se conservan, definir como alias `var(...)`.

---

## PR #44 — login visual refactor (TRA-35)

**Qué hace:** componente `AuthShell` compartido, reescribe login y forgot-password (card oscura compacta), corrige "contrasena"→"contraseña" en forms, mensajes y server actions. Solo frontend auth, sin lógica de negocio.

### Bugs
1. **[media] `public/trackt-logo.png` de 1,16 MB sin ninguna referencia** — nadie lo usa (el logo Activity fue eliminado). Peso muerto permanente en historial. **Quitar antes del merge** (o referenciar + comprimir a SVG/<50 KB).
2. **[baja] Texto "Iniciando sesion..." invisible en loading** — Button aplica `data-loading:text-transparent` + spinner; además `disabled:text-zinc-500` compite y puede solapar texto sobre el spinner. Mismo patrón en forgot-form. Fix: quitar texto condicional y `disabled:text-zinc-500`.

### Mejoras
- **reset-password NO migrado a AuthShell** — queda con el estilo antiguo; inconsistente con el objetivo del PR.
- Hardcodea hex (#070809, #232527, text-zinc-*) en vez de tokens del design system → rompe theming.
- className de inputs/botón duplicado entre login-form y forgot-form → extraer.
- `mode: 'onChange'` (antes onTouched): valida desde la primera tecla — regresión de UX en PR "solo visual".
- Tipografías de 8–9px bajo mínimos de accesibilidad.
- Tildes a medias: "contraseña" sí, pero "sesion/electronico/valido" no → decidir criterio.

---

## PR #43 — "Add files via upload"

**Qué hace:** agrega `documentacion/Arbol de Oportunidad.png` (5,2 MB, 2816×1536, metadatos C2PA de IA de Google con watermark). Cero código.

### Problemas
1. **[media] 5,2 MB sin Git LFS** — el doble del archivo más grande de main; queda en el historial para siempre. Comprimir (<500 KB), usar LFS, o alojar fuera y enlazar desde un .md.
2. **[baja] Sin descripción, sin ticket TRA-***, título autogenerado.
3. **[baja] Nombre con espacios/mayúsculas** vs kebab-case del resto de documentacion/.

**Recomendación: no incluir este PNG tal cual en el PR consolidado.** Decidir: comprimir+renombrar, o cerrar el PR y subir a Drive/Linear.

---

## Conflictos cruzados e integración

Verificado con `git merge-tree` en los 6 pares y simulación de merge secuencial: **cero conflictos textuales**. Los conjuntos de archivos son disjuntos:

- **Stack fase-1..5** (punta `fase-5-generar-ot`): 100% backend (`producto/trackt-api/**`, 54 archivos, 4 migraciones SQL nuevas).
- **#53**: solo `globals.css`.
- **#44**: solo `(auth)/**` + `actions/auth.ts` + PNG.
- **#43**: solo el PNG de documentacion/.

Punto de atención semántico único: **#44 está basada en main viejo** (pre-TRA-36); main endureció `actions/auth.ts` (zod en login + anti host-header-poisoning) después. El merge es limpio y compatible (verificado contrato FormData + searchParams), pero conviene **smoke test manual de login/forgot/reset post-merge**.

Otros avisos de integración:
- El **working tree de main tiene cambios sin commitear** en inventario/evidencias/usuarios/prisma.service que chocan potencialmente con fase-5 (que reescribe inventario.service.ts extensamente). Resolver (commitear o descartar) antes de integrar.
- Tras el merge: `npx prisma generate` obligatorio (DTOs importan enums nuevos de @prisma/client; sin esto el build falla) y aplicar las 4 migraciones en orden (20260610000000 → 20260611000000 → 20260611120000 → 20260611180000).
- Orden recomendado de integración en la rama única: #43 (si se decide incluir) → #53 → #44 → stack fase-1..5.

---

## Gaps propuestos a cerrar antes del PR único

Mínimos (bugs media, fixes chicos y de bajo riesgo):
1. #51: `@IsUUID` en `UpdateProgramacionDto.responsableId` (evita 500).
2. #51: guard anti-TOCTOU en PATCH de programaciones (`updateMany` condicionado, patrón ya existente en `cancelar`).
3. #52: decidir mechanic en generar-ot (asignar `mecanicoId=user.id` o restringir roles).
4. #49: dup-check de marcas considerando AMBOS.
5. #44: eliminar `trackt-logo.png` (1,16 MB sin uso) y quitar texto loading muerto.
6. #43: comprimir/renombrar el PNG o dejarlo fuera del PR consolidado.
7. #52: verificar que el frontend no parsea el message string del 409 de stock.

Opcionales (mejoras, pueden ir a tickets Linear posteriores): normalización legacy de códigos (#48), reset-password a AuthShell (#44), filtro `hasta` fin-de-día (#51), helpers comunes (toBoolean, inicio-de-día, transición OT), limpieza de tokens `--ticket-*` muertos (#53).
