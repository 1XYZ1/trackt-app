# Trackt — Revisión de bugs de obtención de datos (front ↔ API)

> **Alcance:** revisión de los endpoints fases 1-6 (ya mergeados en `main`) cruzando el contrato real del backend (controllers + services + DTOs) contra los wrappers/hooks/páginas del front. Foco: defectos que rompen la **carga o el match de datos** en código YA EXISTENTE (no features faltantes — esas van en `plan-front-fases-1-6.md`).
>
> Metodología: 8 agentes mapearon el backend real y el estado del front por dominio; cada bug candidato se verificó leyendo el código (cadena controller → DTO → ValidationPipe → service → wrapper → hook → componente). **4 candidatos, 4 confirmados.**
>
> Rama base: `main` @ `8a347ca`.

---

## 0. Hallazgo transversal (no es bug, pero corrige el doc fuente)

**El envelope paginado real es anidado:** `{ data: T[], meta: { page, limit, total, totalPages } }` — viene de `producto/trackt-api/src/common/utils/pagination.ts` (`buildPaginatedResult`). **NO** es el plano `{ data, total, page, limit, totalPages }` que asumía `fases-1-6-backend-mapa-y-plan-front.md`.

Implicaciones:
- Para leer paginación hay que usar `result.meta.total` / `result.meta.totalPages`, **no** `result.total`.
- `result.data` está en top-level en ambas formas, así que los wrappers que solo leen `.data` (equipos, ordenes, usuarios, mis-tickets) funcionan, pero **descartan `meta`** (no hay UI de paginación).
- Patrón correcto ya existente: `tickets.ts` (`getAllTickets` itera `first.meta.totalPages`) e `inventario.ts` (`type Paginated<T> = { data, meta }`). **Todo wrapper nuevo debe seguir esta forma.**

Listados que **NO** son envelope (array plano, consumir directo sin `.data`):
- `GET /equipos/:id/repuestos`, `GET /equipos/:equipoId/plantillas`
- `GET /tickets/:ticketId/reservas-repuestos`, `GET /reservas-repuestos`, `GET /tickets/carga-mecanicos`
- `GET /programaciones-mantenimiento/calendario` (eventos `{id,title,start,...}`, campos renombrados)
- Reportes JSON: `{ data: rows, total }` (objeto plano, **no** `meta`); excepto `GET /reportes/equipos/:id/historial` en JSON, que devuelve el objeto historial crudo.

---

## 1. Bugs confirmados

### BUG-1 — `limit=200` rompe TODO el listado de equipos (HTTP 400) · **Severidad ALTA**

- **Archivo:** `producto/tract-front/src/lib/api/equipos.ts:16` y `:75`
- **Cadena verificada:**
  1. `equipos.ts:16` → `export const EQUIPOS_PAGE_LIMIT = 200;`
  2. `equipos.ts:75` → `params.set("limit", String(EQUIPOS_PAGE_LIMIT));` (incondicional en cada `getEquipos`).
  3. `equipos.controller.ts:37-41` → `@Get()` liga `ListEquiposQueryDto`.
  4. `dto/list-equipos-query.dto.ts:12` → extiende `PaginationQueryDto`, **no** redefine `limit`.
  5. `common/dto/pagination-query.dto.ts:11-16` → `@Max(100) limit?: number = 10`.
  6. `main.ts:23-29` → `ValidationPipe({ whitelist, transform })`: violar `@Max` en una prop declarada lanza **400** en dev y prod.
- **Impacto:** `GET /equipos?limit=200` responde 400 siempre. `useEquipos()` queda en error → **la lista de equipos y el `EquipoSelect`** (usado al crear OTs/tickets, `components/equipos/equipo-select.tsx:31`) nunca cargan. Bloquea fases 1-3 y la creación de OTs/tickets.
- **Fix mínimo:** `EQUIPOS_PAGE_LIMIT = 100` (el `@Max(100)` es inclusivo).
- **Fix de fondo (recomendado):** paginación real iterando `meta.totalPages` (ver BUG-4).

### BUG-2 — `getRepuestos` `limit=200` rompe la carga de repuestos (HTTP 400) · **Severidad ALTA**

- **Archivo:** `producto/tract-front/src/lib/api/inventario.ts:206`
- **Cadena verificada:** `getRepuestos` hace `qs.set("limit", "200")` → `ListRepuestosQueryDto extends PaginationQueryDto` (`@Max(100)`) → ValidationPipe → **400** (`"limit must not be greater than 100"`) → `inventario.ts:211-212` lanza `"No se pudieron cargar los repuestos"`.
- **Contraste:** `getMovimientos` usa `limit=100` (`inventario.ts:329`) y pasa.
- **Impacto:** `useRepuestos()` cae en 3 superficies: página `/inventario` (tabla + KPIs), selector de repuesto en `/inventario/movimientos`, y `NuevaReservaDialog`. (El resto de inventario y `/movimientos` siguen vivos para admin/jefe.)
- **Fix mínimo:** `qs.set("limit", "100")`.
- **Fix de fondo:** paginar iterando `meta.totalPages`.

### BUG-3 — `type Repuesto` y payloads desalineados con la respuesta real · **Severidad MEDIA**

- **Archivo:** `producto/tract-front/src/lib/api/inventario.ts:3-19` (type) y `:87-106` (payloads) + `components/inventario/repuesto-form-sheet.tsx`.
- **Causa:** `mapRepuesto()` del backend (`inventario.service.ts:1129-1152`) **siempre** devuelve `marca:{id,nombre}|null`, `marcaId`, `codigoFabricante`, `ubicacionBodega`, `proveedor`. El `type Repuesto` del front no los declara → TS los descarta silenciosamente; la ficha (`repuestos/[id]/repuesto-detalle-client.tsx:198-216`) no los muestra; el form no tiene inputs → **ineditables**.
- **Impacto:** no rompe el request (los DTO son opcionales), pero los 4 campos nuevos + marca quedan **invisibles e ineditables**. Contrato de tipos desincronizado.
- **Fix:**
  1. Añadir a `type Repuesto`: `marca: { id: string; nombre: string } | null; marcaId: string | null; codigoFabricante: string | null; ubicacionBodega: string | null; proveedor: string | null;`
  2. `CreateRepuestoPayload`: `marcaId?/codigoFabricante?/ubicacionBodega?/proveedor?` (string).
  3. `UpdateRepuestoPayload`: los mismos como `string | null` (null = limpiar, igual que `descripcion`/`categoria`).
  4. `repuesto-form-sheet.tsx`: añadir al schema zod, `EMPTY`, `reset()`, `onSubmit` y los `<Input>` (marcaId vía `MarcaSelect` cuando exista).
  5. `repuesto-detalle-client.tsx`: `<Field>` para Marca / Código fabricante / Ubicación / Proveedor (`?? "—"`).
- **Nota:** este fix se solapa con la feature **Repuestos extendidos (Fase 3)** porque `marcaId` necesita `MarcaSelect`. Se implementa junto a esa fase, salvo que se quiera adelantar la parte de solo-lectura.

### BUG-4 — `getOrdenes()` no pagina: el listado de OT se trunca a 10 · **Severidad ALTA**

- **Archivo:** `producto/tract-front/src/lib/api/ordenes.ts:71-77`
- **Cadena verificada:** backend pagina con `limit=10` por defecto (`ordenes.service.ts:165,178-179` + `buildPaginatedResult`). `getOrdenes` pide `/ordenes` **sin** `page`/`limit`, tipa la respuesta como `{ data: OrdenTrabajo[] }` (ignora `meta`) y devuelve solo la primera página.
- **Impacto:** con >10 OTs, todas a partir de la 11 **desaparecen**: lista, filtro client-side y los contadores del summary (`Total OT / Abiertas / Cerradas`, calculados con `ordenes.length` en `ordenes-client.tsx`) quedan capados. Pérdida silenciosa que empeora al crecer el tenant.
- **Fix:** replicar `getAllTickets` (`tickets.ts:79-122`): pedir `?page=N&limit=100` e iterar `meta.totalPages` acumulando `.data`:
  ```ts
  type PaginatedOrdenes = {
    data: OrdenTrabajo[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  };
  const ORDENES_PAGE_SIZE = 100; // @Max(100)
  async function fetchOrdenesPage(page: number): Promise<PaginatedOrdenes> {
    const response = await authFetch(`${API_BASE_URL}/ordenes?page=${page}&limit=${ORDENES_PAGE_SIZE}`);
    return parseJsonResponse<PaginatedOrdenes>(response);
  }
  export async function getOrdenes(): Promise<OrdenTrabajo[]> {
    assertApiBaseUrl();
    const first = await fetchOrdenesPage(1);
    if (first.meta.totalPages <= 1) return first.data.map(adaptOrden);
    const restPages = Array.from({ length: first.meta.totalPages - 1 }, (_, i) => i + 2);
    const rest = await Promise.all(restPages.map(fetchOrdenesPage));
    return [first.data, ...rest.map((r) => r.data)].flat().map(adaptOrden);
  }
  ```
- **Fix de fondo (medio plazo):** filtros/paginación server-side (el backend ya acepta `estado` y `equipoId`; `ordenes-client.tsx:67` filtra en memoria con un `TODO(api)`), pasando `page/estado/equipoId` en la `queryKey`.

---

## 2. Revisado y SIN bug (descartados)

| Área | Verificación | Veredicto |
|---|---|---|
| **Envelope paginado** | Todos los wrappers leen `.data` correctamente; `tickets`/`inventario` además leen `meta`. | OK |
| **`authFetch`** (`http.ts`) | Devuelve `Response` cruda (no hace `.json()` interno) → apto para `.blob()` en CSV/PDF. Retry único tras `refreshSession()` en 401. | OK |
| **`proxy.ts` + `supabase/middleware.ts`** | Refresca sesión SSR, protege rutas privadas, redirige sesión activa fuera de `/login`. | OK |
| **Tickets** | `getAllTickets` pagina bien; detalle con `timeline`; transiciones con optimistic update + rollback; shapes alineados. | OK |
| **OT detalle** (`GET /ordenes/:id`) | `adaptOrdenEstado` mapea bien el enum (`EN_PROCESO→EN_EJECUCION`, `CERRADA→CERRADO`, `CANCELADA→CANCELADO`); tickets remapeados; `responsable` solo `full_name` (email no viene por diseño). | OK (email = dato faltante por diseño, no bug) |
| **Reservas** | Arrays planos consumidos sin `.data` (correcto); `extractError` parsea el 409 estructurado `{faltantes[]}`. | OK |
| **Notificaciones** | `{ data, meta:{total} }`; `count-no-leidas` → `data.count`. | OK |
| **Marcas / Plantillas / Programaciones / Reportes (backend)** | Shapes consistentes, roles correctos, sin defectos internos. | OK (front no existe = feature, no bug) |

---

## 3. Observaciones (no bloquean, decisión de producto)

1. **Roles `/mantenciones`:** el sidebar lo limita a `admin`/`jefe_taller`, pero el backend habilita `mechanic` para GET (lista/calendario/detalle) y `POST generar-ot` (reserva `SOLICITADA`). Decidir si el mecánico ve el calendario.
2. **Ruta duplicada:** coexisten `(app)/ordenes` y `(app)/ordenes-trabajo`. Revisar cuál es la vigente y eliminar la otra (no es bug de datos, sí de routing/confusión).
3. **Paginación UI ausente:** `equipos` e `inventario` fuerzan un `limit` alto y descartan `meta`. Tras los fixes 1/2, conviene paginación real para tenants grandes (se aborda en las fases de cada dominio).

---

## 4. Plan de corrección (gitflow)

Los bugs 1, 2 y 4 son correcciones bloqueantes e independientes de toda feature → **Fase 0** en `plan-front-fases-1-6.md`, un solo PR:

- Rama sugerida: `fix/TRA-XX-front-data-loading` · commit `fix(front): corregir límites de paginación y paginación de OT (TRA-XX)`.
- Incluye: BUG-1, BUG-2, BUG-4.
- BUG-3 se entrega junto a **Fase 3 (Repuestos extendidos)** porque `marcaId` depende de `MarcaSelect` (Fase 1).

**Criterio de aceptación Fase 0:** lista de equipos, `EquipoSelect`, `/inventario` (+ selectores de repuesto) y el listado de OT cargan datos reales; con >10 OTs el conteo del summary coincide con el total del backend. Validar: `npm run lint && npm run build` (front) sin regresiones.
