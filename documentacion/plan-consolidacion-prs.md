# Plan: PR único consolidando los 8 PRs abiertos + fixes de review

## Contexto

Revisión multi-agente de los 8 PRs abiertos (informe en `documentacion/revision-prs-abiertos.md`) encontró: stack apilado #48–#52 (la rama `fase-5-generar-ot` contiene fases 1–4), dos PRs de front (#53 badges, #44 login) y un PNG de 5,2 MB (#43). Cero conflictos textuales entre ramas (verificado con `git merge-tree`). 19 bugs (8 media, 11 baja), ninguno crítico/alto. El usuario decidió: consolidar todo en un único PR, fixear **todos** los bugs (media+baja), renombrar+comprimir la imagen de #43, incluir `CLAUDE.md` y el informe, crear el PR y **esperar su revisión** (sin merge automático ni cierre de PRs viejos todavía).

Diseño detallado de cada fix validado contra el código real de las ramas (agente Plan). Hallazgos clave del diseño:
- Bug "P2002→500" de equipos **ya está cubierto** por `PrismaExceptionFilter` global (mapea P2002→409): no requiere código.
- El front **no parsea** el message del 409 de stock (usa `extractError()` genérico) → el cambio de contrato de fase-5 no rompe nada; solo se pierde detalle (fix de UX barato incluido).

## Paso 0 — Preparar working tree y rama

1. Working tree de main: 7 archivos modificados son **100% reformateo prettier** (verificado hunk a hunk). Descartar (`git restore`) los 3 de inventario (fase-5 ya trae ese reformateo y reescribe el service); conservar los otros 4 (evidencias×2, prisma.service, usuarios.service) para commitearlos en la rama. Tras los merges, `npm run format` recupera cualquier formato perdido.
2. Crear issue en Linear (team TRA) "Consolidación de PRs abiertos + fixes de review" vía MCP → obtener `TRA-XX`. Si falla, seguir sin ID.
3. Rama: `feat/TRA-XX-consolidacion-prs-abiertos` desde `main`.
4. Primer commit: reformateo prettier (4 archivos) + `CLAUDE.md` + `documentacion/revision-prs-abiertos.md` + copia de este plan en `documentacion/plan-consolidacion-prs.md`.

## Paso 1 — Integrar ramas (orden verificado sin conflictos)

```
git merge origin/fase-5-generar-ot        # backend fases 1-5 (54 archivos, 4 migraciones)
git merge origin/fix/TRA-37-corregir-badges-estado-modo-claro
git merge origin/style/TRA-35-login-visual-refactor
```

**Imagen #43 (sin merge de la rama** — mergearla metería el blob de 5,2 MB al historial):
```
git show origin/jaimegosoriou-evidencia:"documentacion/Arbol de Oportunidad.png" > /tmp/arbol.png
npx --yes sharp-cli ... # redimensionar (~1600px ancho) + recomprimir PNG → objetivo <500 KB
# guardar como documentacion/arbol-de-oportunidad.png
```

Luego `npx prisma generate` en `producto/trackt-api` (DTOs importan enums nuevos; sin esto no compila).

## Paso 2 — Fixes backend (sobre la rama integrada)

DTOs puros (sin impacto en specs):
- **F3** `equipos/dto/list-equipos-query.dto.ts` + `equipos.service.ts findAll()`: filtro opcional `estadoOperativo` (`@IsEnum(EquipoEstadoOperativo)`; el índice ya existe). Test nuevo en spec.
- **F5** `inventario/dto/create-repuesto.dto.ts` y `update-repuesto.dto.ts`: `@IsNotEmpty()` en `marcaId` (en update mantiene `ValidateIf` para null=limpiar) — evita que `''` esquive `assertMarcaUsable`.
- **F9** `plantillas-mantenimiento/dto/update-plantilla.dto.ts`: `metadata` acepta `null` (`@ValidateIf((_,v)=>v!==null)`); en el service, `metadata===null → Prisma.DbNull`.
- **F10** `programaciones-mantenimiento/dto/update-programacion.dto.ts`: `responsableId` pasa de `IsString/MaxLength` a `@ValidateIf((_,v)=>v!==null) @IsUUID()` (patrón de `asignar-ticket.dto.ts`; evita 500 por cast `::uuid` en `$queryRaw`).

Services con tests:
- **F4** `marcas.service.ts assertNombreDisponible()`: dup-check con solapamiento de ámbito — `tipo !== AMBOS → tipo: {in:[tipo, AMBOS]}`; `AMBOS` → sin filtro de tipo. Tests: colisión EQUIPO↔AMBOS en ambas direcciones.
- **F6** `marcas.service.ts update()`: al cambiar tipo hacia `EQUIPO`, `repuesto.count({where:{tenantId, marcaId:id}})` > 0 → 409. Agregar `repuesto.count` al mock del spec + 2 tests.
- **F8** `plantillas-mantenimiento.service.ts addItem/updateItem`: `observacion` con `normalizeOptional()` (`''`→null). Test.
- **F14** `resolverItemsReserva()`: ajuste a cantidad 0 sobre item `obligatorio=true` → 400. Test nuevo; ajustar test existente de exclusión para usar `obligatorio:false`.
- **F15** `resolverItemsReserva()`: `repuestoId` duplicado en `ajustarItems` → 400 (hoy last-write-wins silencioso). Test.

Fixes con transacciones (los más invasivos en specs):
- **F7** TOCTOU check-activo→create: envolver en `$transaction` `equipos-plantillas.service.ts add()` y `plantillas-mantenimiento.service.ts addItem()`, con re-check de `activo` post-create dentro de la tx (check-after-write). Specs: mock `$transaction.mockImplementation(fn => fn(prisma))` (patrón ya usado en otros specs del repo).
- **F11** `programaciones-mantenimiento.service.ts update()`: guard anti-TOCTOU — `updateMany({where:{id, tenantId, estado: PROGRAMADA}})`; count 0 → releer y distinguir 404/409; retornar `findOne()` (patrón de `cancelar()` del mismo archivo). Specs del describe `update` se re-mockean; +2 tests (409/404).
- **F13** `generarOt()`: cuando `user.role==='mechanic'`, dentro de la misma tx tras `tickets.crearEnTx`: `tx.ticket.update` → `{estado: ASIGNADO, mecanicoId: user.id, fechaAsignacion}` + evento `PENDIENTE→ASIGNADO` en `eventoEstadoTicket` (replica semántica de `asignar()`). `jefeId` queda como lo setea `crearEnTx` (no se ramifica la firma compartida). Tests: mechanic → update+evento; admin → no.
- **F16** `generarOt()`: releer `metadata` con `tx...findUniqueOrThrow` dentro de la tx antes del update final (evita pisar un PATCH concurrente). Test con metadata releída ≠ inicial.
- **F12** filtro `hasta` fin-de-día: helper `parseFechaHasta()` — si `value` es `YYYY-MM-DD` → `lt hasta+1d`, si trae hora → `lte`. Aplicar en `buildRangoFechas()` y `calendario()`; validaciones de rango contra la fecha original. Tests para ambos formatos.

Migración:
- **F1** Nueva `supabase/migrations/20260612000000_equipos_codigo_backfill.sql` (NO editar la de fase-1, puede estar aplicada en entornos de las ramas): `DO $$` que cuenta colisiones post-`UPPER(TRIM())` por tenant y hace `RAISE EXCEPTION` si hay; si no, `UPDATE equipos SET codigo = UPPER(TRIM(codigo)) WHERE codigo <> UPPER(TRIM(codigo))`. Idempotente.
- **F2** (P2002→409 equipos): **sin cambio** — ya cubierto por `PrismaExceptionFilter` global. Documentado en informe.

## Paso 3 — Fixes front

- **F17** `app/(auth)/login/login-form.tsx` y `forgot-password/forgot-form.tsx`: quitar texto condicional de loading (invisible: Button aplica `data-loading:text-transparent` + Spinner), quitar `disabled:text-zinc-500` (compite con el transparent) y `disabled={pending}` (redundante con `loading`).
- Eliminar `producto/tract-front/public/trackt-logo.png` (1,16 MB, cero referencias).
- **F18** (UX, barato) `lib/api/inventario.ts extractError()`: si el body trae `faltantes[]`, concatenar detalle por repuesto al mensaje del toast (recupera el detalle perdido por el nuevo shape del 409 de stock).

## Paso 4 — Validación

```
cd producto/trackt-api && npm run build && npm run test && npm run lint
cd producto/tract-front && npm run lint && npm run build
```
Verificar tamaño final del PNG (<500 KB) y que no quede ningún blob >1 MB nuevo en la rama (`git diff --stat main...HEAD`).

## Paso 5 — PR

- Push + `gh pr create` hacia `main`. Título: `feat: consolidación PRs #43-#53 — fases 1-5, fixes de front y correcciones de review (TRA-XX)`.
- Descripción: resumen por PR original (qué aporta cada uno), lista de los 19 bugs corregidos con severidad, cambio de contrato del 409 de stock, notas de despliegue (orden de las 5 migraciones `20260610→20260612`, `prisma generate` obligatorio post-merge), y referencia a `documentacion/revision-prs-abiertos.md`. Footer estándar de Claude Code.
- **No** mergear ni cerrar #43–#53: queda esperando revisión del usuario. (Cierre de los 8 PRs viejos con comentario de consolidación = paso posterior tras su ok.)

## Riesgos

- El grueso del retrabajo de tests se concentra en `programaciones-mantenimiento.service.spec.ts` (~20 tests tocan mocks de `update`/`generarOt`).
- La migración de backfill aborta a propósito si hay colisiones reales de códigos en BD (mejor abortar que fusionar equipos) — anotado en la descripción del PR.
- Compresión del PNG vía `npx sharp-cli` (sin magick/ffmpeg en el sistema); si el diagrama no baja de 500 KB sin perder legibilidad, se acepta el mejor resultado y se anota en el PR.
