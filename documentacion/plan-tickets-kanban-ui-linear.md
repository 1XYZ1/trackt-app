# Pulir UI/UX del kanban /tickets estilo Linear (TRA-36, iteración 2)

## Contexto

El kanban mergeado en PR #46 funciona pero la UI no aprovecha el espacio (screenshot del usuario):
- Aparece **scroll horizontal** — las 5 columnas no caben (`min-w-64` + paddings de Card anidados).
- Cards **duplican el StatusBadge** (la columna ya indica el estado) y desperdician espacio interno; títulos truncados a pocas letras.
- Todo vive dentro de un `Card` grande ("Listado de tickets") con mucho chrome: doble borde, doble padding, header redundante.
- La página entera scrollea; en Linear el layout es **fijo** y solo las columnas scrollean verticalmente.

Objetivo (referencia: screenshot de Linear): 5 columnas siempre visibles sin barra horizontal, layout de viewport fijo donde solo el contenido de cada columna scrollea, cards densas estilo Linear, menos chrome.

**Git**: misma rama `feature/TRA-36-tickets-kanban-lista` (ya mergeada en #46 — se le agrega un commit nuevo encima de main y se abre un **nuevo PR** hacia main; un PR merged no se reabre). 1 commit. Referencia Linear: TRA-36.

## Datos del layout (verificados)

- App shell: `(app)/layout.tsx` → `Header` sticky `h-16` + `div.flex.flex-1.flex-col.gap-4.p-4.md:p-6` + `Footer` (py-3). `SidebarInset` no limita altura.
- Archivos a tocar (todos creados en la iteración 1):
  - `producto/tract-front/src/app/(app)/tickets/tickets-client.tsx`
  - `producto/tract-front/src/components/tickets/kanban/tickets-kanban.tsx`
  - `producto/tract-front/src/components/tickets/kanban/kanban-column.tsx`
  - `producto/tract-front/src/components/tickets/kanban/kanban-card.tsx`
- Reusar: `PRIORIDAD_DOT`/`PRIORIDAD_LABEL`/`formatRelativeDate` (`lib/tickets/format.ts`), `ESTADO_DOT` pattern (hoy en `tickets-lista.tsx` — extraerlo a `lib/tickets/format.ts` para compartir), `UserAvatar`, `usePrefetchTicket`.

## Cambios

### 1. `tickets-client.tsx` — shell compacto, viewport fijo en kanban

- **Eliminar el `Card` wrapper** ("Listado de tickets") y el header descriptivo largo. Nueva estructura:
  - Fila 1 (única, compacta): título `Tickets` + contador de resultados a la izquierda; a la derecha: search (w-64), input mecánico (w-44), input OT (w-36), toggle vista. Inputs `h-8` `text-xs`. En `lg-` se apilan (flex-wrap).
  - En vista lista se agrega debajo la fila de chips de estado (igual que hoy).
- **Vista kanban con altura fija**: contenedor del board `h-[calc(100svh-11rem)]` (header 4rem + paddings/topbar ≈7rem; ajustar al pixel al verificar) con `min-h-0`. El board NO scrollea la página: solo las columnas internamente. Vista lista mantiene flujo normal (scroll de página).
- Quitar el Badge "Filtros en URL" (ruido) y el subtítulo largo; dejar `<p>` corto solo si cabe.

### 2. `tickets-kanban.tsx` — grid de 5 columnas sin scroll horizontal

- Reemplazar `flex gap-3 overflow-x-auto` por:
  - `xl+`: `grid grid-cols-5 gap-2 h-full min-h-0` — las 5 columnas reparten el ancho completo, sin `min-w`.
  - `<xl` (fallback): `flex overflow-x-auto` con `min-w-56` por columna (pantallas chicas no caben 5).
  - Implementación: `grid h-full min-h-0 grid-flow-col auto-cols-[minmax(14rem,1fr)] gap-2 overflow-x-auto xl:grid-cols-5 xl:overflow-visible`.
- DragOverlay usa la nueva card compacta (no `TicketCard`).

### 3. `kanban-column.tsx` — columna estilo Linear

- Header: reemplazar `StatusBadge` por **dot de color + label + count** (`ESTADO_DOT` + `ticketEstadoLabel`), `text-xs font-semibold`, `px-2 py-1.5`, sticky `top-0` dentro del scroll de la columna.
- Cuerpo: `flex-1 min-h-0 overflow-y-auto` — el scroll vertical vive AQUÍ (clave del layout fijo). Scrollbar fino (`[scrollbar-width:thin]`).
- Estética: columna sin borde completo — `bg-muted/20 rounded-lg` o transparente con separación por gap (como Linear); mantener highlight de drop (`ring-1 brand` cuando `isOver`) y el dimming actual.

### 4. `kanban-card.tsx` — card densa estilo Linear (markup propio, deja de usar `TicketCard`)

Estructura (referencia card de Linear):
```
┌──────────────────────────────┐
│ ITCM-5003              (AV)  │  ← código mono text-[11px] muted · UserAvatar size-5 der
│ Cambio aceite hidráulico     │  ← título text-sm font-medium line-clamp-2
│ ● Alta  ⚙ EQ-C02 - Retro...  │  ← dot prioridad + label · equipo truncado text-xs muted
└──────────────────────────────┘
```
- `p-2.5`, `gap-1.5`, `rounded-md border border-border/60 bg-card`, hover `border-brand-primary/40`.
- Sin `StatusBadge` (la columna ya lo dice). Sin label "Sin mecanico" textual — avatar con tooltip/title; si no hay mecánico, avatar placeholder atenuado.
- Mantener: `useDraggable`, prefetch en hover, click → detalle, `opacity-50` mientras se arrastra, cursor grab solo si draggable.
- `TicketCard` de core queda intacta (la usan otras vistas).

### 5. Compartir `ESTADO_DOT`

Mover el mapa `ESTADO_DOT` de `tickets-lista.tsx` a `lib/tickets/format.ts` (export) e importarlo en lista y columna kanban.

## Gitflow

1. `git checkout feature/TRA-36-tickets-kanban-lista && git merge main` (o rebase sobre main — la rama quedó atrás del merge commit).
2. 1 commit: `feat(front): kanban denso estilo Linear con layout fijo (TRA-36)`.
3. Push + **nuevo PR** hacia main (mostrar URL).

## Verificación

1. `npx tsc --noEmit`, `npm run lint`, `npm run build` en tract-front.
2. `npm run dev` + abrir `/tickets` a 1280px y 1536px: 5 columnas visibles SIN scrollbar horizontal; página sin scroll vertical en vista kanban; columnas scrollean individualmente con >5 cards.
3. Cards: sin badge de estado, título 2 líneas, avatar arriba derecha, dot prioridad + equipo abajo.
4. Drag sigue funcionando (DragOverlay con card nueva, dimming de columnas inválidas, drop → dialog).
5. Vista lista intacta.
