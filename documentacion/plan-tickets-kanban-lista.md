# Rediseño /tickets: Kanban + Lista estilo Linear con drag-and-drop

## Contexto

La ruta `/tickets` hoy es un grid plano de cards con filtros URL. El usuario quiere: vista kanban + vista lista estilo Linear conmutables, drag-and-drop para mover tickets entre estados, UI minimalista, precarga de datos para agilidad, y fix de bugs de la ruta.

**Bug crítico encontrado**: `getTickets()` (`producto/tract-front/src/lib/api/tickets.ts:66-75`) llama `GET /tickets` sin query params; el backend pagina con `limit=10` default → **la lista solo muestra los primeros 10 tickets**.

Decisiones del usuario:
- DnD solo cambia estado (sin orden manual persistido — no agregar campo `position`).
- Respetar workflow estricto por rol (columnas inválidas se atenúan y rechazan drop).
- Incluir fixes críticos backend (paginación, race conditions TOCTOU), sin cambiar reglas de negocio.

**Convención Next.js 16** (ver `producto/tract-front/AGENTS.md`): leer guías en `node_modules/next/dist/docs/` antes de codear. `searchParams`/`params` son Promise (ya respetado en `page.tsx`); `cookies()` async; sin `cacheComponents`.

## Stack y datos clave

- Front: `producto/tract-front` — Next.js 16 App Router, React 19, TanStack Query 5 (staleTime global 60s en `src/app/providers.tsx`), Tailwind 4, shadcn. Sin librería DnD instalada.
- Back: `producto/trackt-api` — NestJS + Prisma. `GET /tickets` paginado (limit max 100, filtros estado/mecanicoId/otId), transiciones: `POST /tickets/:id/{asignar|reasignar|iniciar|finalizar|validar|cerrar}`.
- Estados: `PENDIENTE → ASIGNADO → EN_EJECUCION → EJECUTADO → CERRADO` (+ `CANCELADO` terminal).
- Roles vía `useAuth()`/`useRole()` (`src/contexts/auth-context.tsx`); `useAuth().id` = userId para chequear mecánico asignado. `UserRole = 'admin' | 'jefe_taller' | 'mechanic'`.
- Verificado: `ui/toggle-group.tsx` y `ui/collapsible.tsx` existen. Dialogs reusables: `asignar-mecanico-dialog.tsx`, `validar-ticket-dialog.tsx`, `reasignar-ticket-dialog.tsx` en `src/components/tickets/`.
- **NO es bug**: `hashtextextended(text, bigint)` existe en PG≥11; el repo lo usa deliberadamente (`inventario.service.ts:981-990`). Cleanup opcional: unificar `hashtext` → `hashtextextended(key, 0)` en `tickets.service.ts:91` y `ordenes.service.ts:111`.

## Librería DnD: `@dnd-kit/core`

`cd producto/tract-front && npm install @dnd-kit/core`

Compatible React 19, accesibilidad de fábrica (KeyboardSensor + announcements). NO instalar `@dnd-kit/sortable` (no hay orden manual).

## Matriz de transiciones — fuente única de verdad

Nuevo `producto/tract-front/src/lib/tickets/transitions.ts`:

```ts
export type TransitionAction = "asignar" | "iniciar" | "finalizar" | "validar_aprobar" | "validar_rechazar";
export type TicketTransition = {
  from: TicketEstado; to: TicketEstado; action: TransitionAction;
  roles: UserRole[]; soloMecanicoAsignado?: boolean; requiereDialog: boolean;
};
export const TICKET_TRANSITIONS: TicketTransition[] = [
  { from: "PENDIENTE",    to: "ASIGNADO",     action: "asignar",          roles: ["admin","jefe_taller"], requiereDialog: true },
  { from: "ASIGNADO",     to: "EN_EJECUCION", action: "iniciar",          roles: ["mechanic"], soloMecanicoAsignado: true, requiereDialog: false },
  { from: "EN_EJECUCION", to: "EJECUTADO",    action: "finalizar",        roles: ["mechanic"], soloMecanicoAsignado: true, requiereDialog: true },
  { from: "EJECUTADO",    to: "CERRADO",      action: "validar_aprobar",  roles: ["admin"], requiereDialog: true },
  { from: "EJECUTADO",    to: "EN_EJECUCION", action: "validar_rechazar", roles: ["admin"], requiereDialog: true },
];
// helpers: getTransition(ticket, to, role, userId), getValidTargets(ticket, role, userId), canDrag(ticket, role, userId)
```

Notas: `iniciar`/`finalizar` son `@Roles('mechanic')` en backend → admin NO arrastra esas transiciones. EJECUTADO→CERRADO usa `/validar {aprobado:true}` (reusa ValidarTicketDialog). Reasignar NO es drag (queda en dialog existente). CANCELADO nunca es target.

## Archivos a crear/modificar

```
producto/tract-front/src/
  app/(app)/tickets/page.tsx            MOD: prefetch SSR + HydrationBoundary
  app/(app)/tickets/tickets-client.tsx  MOD: shell (header, filtros, toggle, render vista)
  components/tickets/
    tickets-view-toggle.tsx             NUEVO: ToggleGroup kanban/lista
    finalizar-ticket-dialog.tsx         NUEVO: observación opcional (FinalizarTicketDto: observacion? max 2000)
    kanban/tickets-kanban.tsx           NUEVO: DndContext + columnas + DragOverlay + dialogs de drop
    kanban/kanban-column.tsx            NUEVO: useDroppable, header StatusBadge+count, atenuado si inválida
    kanban/kanban-card.tsx              NUEVO: useDraggable + TicketCard + hover prefetch
    lista/tickets-lista.tsx             NUEVO: grupos por estado colapsables
    lista/tickets-lista-row.tsx         NUEVO: fila densa estilo Linear
  lib/tickets/transitions.ts            NUEVO: matriz (arriba)
  lib/api/tickets.ts                    MOD: getAllTickets paginado; mover iniciar/finalizar aquí desde mis-tickets
  lib/api/tickets.server.ts             NUEVO: fetch server-side con token de cookies (server-only)
  components/core/types.ts              MOD: export TICKET_ESTADOS const array + ticketEstadoLabel()
  hooks/use-tickets.ts                  MOD: optimistic updates, invalidaciones acotadas, staleTime/focus, useIniciarTicket/useFinalizarTicket
  hooks/use-mis-tickets.ts (o similar)  MOD: recortar invalidación ["ordenes"] → ["ordenes", ordenId]

producto/trackt-api/src/tickets/tickets.service.ts   MOD: guards updateMany anti-TOCTOU (6 métodos)
producto/trackt-api/src/tickets/tickets.service.spec.ts  MOD: tests count:0 → ConflictException
```

## Fetching y precarga

1. **Fix paginación**: `getAllTickets()` itera `?page=N&limit=100` hasta `meta.totalPages` (página 1 secuencial, resto en `Promise.all`). `getTickets` delega ahí. Kanban necesita el set completo; volumen taller = moderado. Si `meta.total > ~1000`, `console.warn` (señal de migrar a server-side filtering).
2. **SSR prefetch**: en `page.tsx`, `new QueryClient()` + `prefetchQuery({ queryKey: ["tickets"], queryFn: getTicketsServer })` + `<HydrationBoundary state={dehydrate(qc)}>`. `tickets.server.ts` arma fetcher con Bearer token de sesión Supabase (`createClient` de `lib/supabase/server`, `cache: "no-store"`). Misma queryKey `["tickets"]` que `useTickets()` → primer paint sin spinner. Si falla el prefetch, el cliente refetchea normal.
3. **Prefetch detalle en hover** (card kanban y fila lista): `queryClient.prefetchQuery({ queryKey: ["tickets", id], queryFn: () => getTicketById(id), staleTime: 30_000 })`.
4. **Staleness**: en `useTickets()` (no global): `refetchOnWindowFocus: true, staleTime: 30_000`.

## Mutaciones optimistas (use-tickets.ts)

`useTicketTransition` gana `onMutate` (cancelQueries `["tickets"]`, snapshot, `setQueryData` con patch optimista por acción) + `onError` rollback con toast (`extractError` del backend) + `onSettled`/`onSuccess` con invalidaciones **acotadas**:

```ts
queryClient.setQueryData(["tickets", ticketId], ticket);   // respuesta de la mutación
queryClient.invalidateQueries({ queryKey: ["tickets"], exact: true });
queryClient.invalidateQueries({ queryKey: ["ordenes", ticket.ordenId] });
// ["ordenes"] lista completa SOLO en validar/cerrar aprobado (puede cerrar la OT padre)
```

Patches: asignar→`ASIGNADO`+mecanico, iniciar→`EN_EJECUCION`, finalizar→`EJECUTADO`, validar aprobado→`CERRADO`, rechazado→`EN_EJECUCION`.

## Kanban

- Columnas: PENDIENTE, ASIGNADO, EN_EJECUCION, EJECUTADO, CERRADO. CANCELADO no es columna (visible en lista/filtros). CERRADO capada a últimos 20 + contador.
- Filtros `q`/`mecanico`/`ot` aplican antes de bucketizar; filtro `estado` se oculta en kanban (se mantiene en lista).
- `DndContext` con `PointerSensor` (`activationConstraint: { distance: 8 }` para no romper click→detalle) + `KeyboardSensor`.
- `onDragStart`: `getValidTargets()`; columnas inválidas → `opacity-40` + drop deshabilitado. Si `canDrag()` false, card sin `useDraggable`.
- `onDragEnd`: drop inválido/null → no-op. Válido sin dialog (`iniciar`) → mutación optimista inmediata. Con dialog → guardar `pendingDrop {ticketId, action}` y abrir dialog correspondiente; confirmar dispara mutación (optimista), cancelar limpia sin cambios.
- `DragOverlay` con TicketCard (sombra/rotación leve), original `opacity-50`.
- `announcements` en español para screen readers.

## Vista lista (Linear)

- Agrupada por estado en orden de workflow; headers colapsables (`ui/collapsible.tsx`) con dot de estado (tokens `bg-estado-*-dot` de `status-badge.tsx`), label, count. CERRADO/CANCELADO colapsados por defecto.
- Filas densas ~36px, `divide-y`: dot prioridad (ALTA roja/MEDIA ámbar/BAJA neutra) · código mono xs muted · título truncate flex-1 · equipo `hidden md:block` · dot estado · UserAvatar size-5 + nombre `hidden lg:block` · fecha relativa xs. Fila completa = `<Link href={/tickets/${id}}>` con hover `bg-muted/50` + prefetch datos.

## Toggle vista

- URL param `?vista=kanban|lista`, default kanban. Mismo patrón `router.replace` de `updateFilter`.
- Persistencia en `localStorage("tickets:vista")`; al montar sin param, leer en `useEffect` post-mount y `router.replace` (evita hydration mismatch). URL gana sobre localStorage.

## Fixes adicionales front

- Estados duplicados: eliminar array `estados` hardcodeado y `estadoLabel` local de `tickets-client.tsx:31-54`; usar `TICKET_ESTADOS`/`ticketEstadoLabel` de `core/types.ts`.
- Mover `iniciar`/`finalizar` de `lib/api/mis-tickets.ts` a `lib/api/tickets.ts` y reimportar (sin duplicar).

## Fixes backend (tickets.service.ts)

Anti-TOCTOU: dentro de la TX, reemplazar `tx.ticket.update({where:{id}})` por `tx.ticket.updateMany({where:{id, tenantId, estado: ESPERADO}, data})` + `if (count !== 1) throw new ConflictException("El ticket cambió de estado, recarga e intenta de nuevo")`. Patrón ya existe en el repo (`createFromOrden` ~138-155). Aplicar en:

| Método | Guard `where` |
|---|---|
| asignar (~288) | `estado: PENDIENTE` |
| iniciar (~344) | `estado: ASIGNADO, mecanicoId: userId` |
| finalizar (~401) | `estado: EN_EJECUCION, mecanicoId: userId` |
| validar (~459) | `estado: EJECUTADO` |
| cerrar (~544) | `estado: EJECUTADO` |
| reasignar (~658) | `estado: ticket.estado` (guard exacto al leído) |

Tests: mock `updateMany → {count: 0}` espera `ConflictException`. Opcional 2 líneas: unificar `hashtext` → `hashtextextended(key, 0)` en `tickets.service.ts:91` y `ordenes.service.ts:111`.

## Orden de implementación

1. Backend: guards updateMany + tests (`npm test` en trackt-api).
2. Tipos + API front: `types.ts`, `lib/api/tickets.ts` (paginación, iniciar/finalizar), `tickets.server.ts`.
3. Hooks: `use-tickets.ts` (optimistic, invalidaciones, staleness, nuevos hooks), recorte en mis-tickets.
4. `lib/tickets/transitions.ts`.
5. SSR prefetch en `page.tsx`.
6. Vista lista + toggle + refactor shell `tickets-client.tsx` (valida fetching antes de DnD).
7. Kanban: instalar `@dnd-kit/core`, componentes, dialogs en drop.
8. Pulido: hover prefetch, a11y announcements, empty states por columna.

## Verificación

1. Levantar API (`producto/trackt-api`: `npm run start:dev`) y front (`producto/tract-front`: `npm run dev`).
2. Con >10 tickets: `/tickets` muestra TODOS; primer paint sin spinner (Network: sin refetch al montar).
3. Admin: drag PENDIENTE→ASIGNADO abre dialog mecánico (confirmar mueve, cancelar restaura); PENDIENTE→EN_EJECUCION atenuada/rechaza; EJECUTADO→CERRADO abre validar-aprobar; EJECUTADO→EN_EJECUCION abre rechazar.
4. Mecánico: ASIGNADO→EN_EJECUCION instantáneo (optimista); EN_EJECUCION→EJECUTADO pide observación; resto rechaza.
5. Carrera: dos pestañas admin arrastran mismo ticket EJECUTADO→CERRADO → segunda recibe 409 + toast + rollback.
6. Toggle `?vista=lista` persiste (navegación y recarga vía localStorage).
7. Volver a pestaña tras >30s → refetch.
8. Teclado: tab a card, space levanta, flechas mueven, space suelta.
9. `npm run lint` y `npm run build` en tract-front; `npm test` en trackt-api.
