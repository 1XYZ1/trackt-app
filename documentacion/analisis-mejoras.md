# Análisis de Mejoras — Trackt

> Documento de auditoría consolidado a partir de hallazgos verificados (cada uno refutado adversarialmente contra el código actual; se conservan solo los reales). Severidad reportada = `severityAdjusted` post-verificación. Evidencia citada como `archivo:línea`.

---

## 1. Resumen ejecutivo

### 1.1 Conteo por dimensión

| Dimensión | Hallazgos |
|---|---|
| (a) Seguridad / Multi-tenant | 8 |
| (b) Convenciones / Arquitectura | 7 |
| (c) Completitud de flujos / UX | 7 |
| (d) Redundancias / Deuda técnica | 14 |
| **Total** | **36** |

> Nota de deduplicación: varios hallazgos describen el **mismo defecto** desde dimensiones distintas. Tras agrupar duplicados, el universo de problemas únicos es **~28**. Los duplicados se anotan explícitamente en cada sección y se cuentan **una sola vez** en el backlog (sección 3). Conteo por dimensión arriba refleja las entradas crudas verificadas; el backlog refleja los problemas únicos.

### 1.2 Conteo por severidad (post-ajuste, entradas crudas)

| Severidad | Cantidad |
|---|---|
| High | 3 |
| Medium | 14 |
| Low | 19 |

### 1.3 Agrupaciones de duplicados detectadas

- **D1 — Guards no globales (sin `APP_GUARD`):** aparece 3 veces (convención #5, seguridad #6, deuda #14). Se trata como **un** ítem.
- **D2 — Query de `profiles`/`getUserSummaries` duplicado:** aparece 2 veces (convención #2, redundancia). Se trata como **un** ítem, más el corolario de `assertCanActOnTicket` triplicado.
- **D3 — Máquina de estados de OT colapsada en Ticket + mapeo de estado OT triplicado:** convención (alias `OtEstado = TicketEstado`) + redundancia (3 copias del mapeo) describen la **misma raíz**. Se listan como dos ángulos del mismo problema, con un ítem de backlog combinado.
- **D4 — `jefe_inventario` y la matriz de reservas (aprobar/liberar/consumir):** el dead-end de "Rechazar/Liberar" aparece como hallazgo de seguridad (#13, low) y como dos hallazgos de UX (high). La **causa raíz es única** (`assertCanActOnTicket` no contempla `jefe_inventario` + `@Roles` incoherente); el impacto UX es lo que eleva la severidad. Se consolida en un ítem high de backlog.
- **D5 — Rutas `(app)` sin `requireRole` server-side:** aparece como seguridad (#11) y como UX (#22). Mismo defecto, un ítem.
- **D6 — Mutaciones de perfil/usuarios en Server Actions saltando la API:** convención (#4) y el lado funcional RLS (#10, seguridad) comparten raíz (write-path de identidades fuera de NestJS). Se mantienen como dos facetas: una de **arquitectura** (L) y otra de **bug funcional RLS** (S, quick win).
- **D7 — Comentarios/contrato de `profiles` obsoletos (TRA-14/TRA-17, roles):** convención (#1) y deuda (#34) son el mismo drift de documentación/tipos. Un ítem.
- **D8 — Enums con valores muertos / chips fantasma:** "enums sin path de escritura" (deuda), "CANCELADO de Ticket como filtro fantasma" (UX) y "OT_CREADA/OT_CERRADA nunca emitidos" (deuda) son instancias del mismo patrón (UI materializa estados/eventos inalcanzables). Se agrupan temáticamente.

### 1.4 Top 5 riesgos / oportunidades

1. **`jefe_inventario` no puede cerrar su flujo nuclear (rechazar/liberar reservas) — HIGH, esfuerzo S.** Su pantalla principal (`/inventario/reservas-pendientes`) muestra "Rechazar" que **siempre da 403**, y la sección de reservas del ticket ni siquiera carga (403) para el rol. La matriz `@Roles` aprobar/liberar/consumir es incoherente y `assertCanActOnTicket` no contempla al rol. *Mayor impacto / menor esfuerzo del informe → quick win prioritario.*
2. **Cancelar OT es un dead-end sin salida — HIGH, esfuerzo M.** No existe UI ni wrapper para `POST /ordenes/:id/cancelar`; una OT atascada (ticket que nunca cierra) deja reservas de inventario **bloqueadas sin remedio in-app**, requiriendo SQL manual. Es el único camino documentado para liberar la cascada.
3. **Seguridad opt-in: guards no globales (`APP_GUARD` ausente) — MEDIUM, esfuerzo M.** La autenticación depende de recordar `@UseGuards` en cada controller; el patrón **ya falló** (`GET /` quedó público). Un controller futuro olvidadizo nace sin auth y expone datos del tenant en silencio. Riesgo sistémico creciente.
4. **Rutas de negocio sin guard server-side de rol — MEDIUM, esfuerzo M.** `/tickets`, `/ordenes`, `/reportes`, `/equipos`, `/marcas`, `/plantillas`, `/mantenciones` solo hacen `requireSession`; el aislamiento de navegación es cosmético (sidebar client-side). El backstop es la API, pero la UX se rompe (un mechanic carga el kanban; `/reportes` queda en error 403 en vez de redirigir).
5. **Write-path de identidades fragmentado fuera de NestJS — MEDIUM (arquitectura L) + bug funcional (S).** Alta de usuarios y asignación de rol viven en Server Actions del front escribiendo directo a Supabase (`service_role` en runtime de Next), saltando `RolesGuard`. Además, **la edición de perfil falla silenciosamente** (`profiles` no tiene policy RLS de UPDATE → 0 filas afectadas, `{ok:true}` engañoso). Oportunidad: centralizar identidades en la API + cerrar el bug de perfil.

**Oportunidad transversal (deuda):** ~250–300 LOC de boilerplate HTTP duplicado en 12 wrappers de `lib/api` + patrón fetch-all en 7 dominios + helpers de autorización/estado triplicados. Extracción a módulos compartidos reduce drift ya presente y superficie de mantenimiento de toda la capa de datos del front.

---

## 2. Hallazgos por dimensión

---

### (a) Seguridad / Multi-tenant

---

#### S-1. `profiles` sin policy RLS de UPDATE: las Server Actions de perfil escriben con cliente `authenticated` y RLS las deniega (bug funcional silencioso + autorización partida)

- **Severidad:** Medium
- **Evidencia:**
  - `producto/trackt-api/supabase/migrations/20260517200000_rls_policies_triggers.sql:47-60` (RLS on `profiles`, solo `for select`); `20260519000000_role_jefe_taller.sql:69-75` y `20260618000000_role_jefe_inventario.sql:64-70` agregan **solo** policies SELECT. No existe ninguna policy `for update/insert/delete` en `profiles` (grep confirmado en todas las migraciones).
  - `producto/tract-front/src/app/actions/profile.ts:45-48` (`updateProfile`) y `:95-98` (`uploadAvatar`) ejecutan `supabase.from('profiles').update(...)` con el cliente SSR `authenticated` (no admin).
- **Impacto:** Con RLS activo y sin policy UPDATE, Postgres afecta 0 filas y el cliente Supabase JS retorna `error=null`, por lo que `profile.ts:50/100` (`if (error)`) es falso y la acción retorna `{ok:true}`: **el cambio de nombre/avatar de cualquier usuario real falla en silencio** y la UI muestra éxito. Matiz verificado: en `uploadAvatar` el archivo **sí** sube al bucket (policies correctas en `20260517180000_add_avatars_bucket.sql:20-40`), pero `avatar_url` nunca persiste. La única mutación de identidad que pasa es `inviteUser` vía `service_role`, fragmentando la autorización (RolesGuard en API vs RLS/`requireRole` en front). Riesgo latente: si se agregara una policy UPDATE permisiva sin fijar `role`/`tenant_id`, un usuario podría auto-promoverse de rol o cambiar de tenant.
- **Recomendación accionable:** Agregar policy con check restrictivo:
  ```sql
  create policy profiles_update_self on public.profiles
    for update to authenticated
    using (id = auth.uid())
    with check (
      id = auth.uid()
      and role = (select role from profiles where id = auth.uid())
      and tenant_id = public.auth_tenant_id()
    );
  ```
  Idealmente, mover la mutación de perfil/usuarios a un módulo NestJS (`POST/PATCH /usuarios`) y dejar el `service_role` solo en el backend.
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### S-2. Guards no registrados como `APP_GUARD` global: seguridad opt-in por controller; un olvido deja el endpoint sin auth *(D1 — duplicado con C-5 y T-13)*

- **Severidad:** Medium
- **Evidencia:** `producto/trackt-api/src/app.module.ts:39-42` registra solo `PrismaExceptionFilter` como `APP_FILTER`; **no** registra `AuthGuard`/`RolesGuard` como `APP_GUARD` (ni importa `APP_GUARD`). No hay `useGlobalGuards` en `main.ts` (grep de `APP_GUARD`/`useGlobalGuards` = 0). 15 controllers repiten `@UseGuards(AuthGuard, RolesGuard)` (p.ej. `tickets.controller.ts:30`, `inventario.controller.ts:31`, `reservas-repuestos.controller.ts:34`). `producto/trackt-api/src/app.controller.ts:10-13` expone `GET /` (`getHello`) **sin ningún guard**.
- **Impacto:** Modelo de autorización opt-in: un controller nuevo que olvide el decorador nace sin `AuthGuard` (acceso anónimo a datos del tenant), en silencio. El patrón **ya falló** (`getHello`). Exposición real hoy = nula (`app.service.ts:5-7` devuelve string estático), pero es deuda arquitectónica que escala el riesgo con cada módulo.
- **Recomendación accionable:** Registrar `AuthGuard` y `RolesGuard` como `APP_GUARD` globales en `app.module.ts` y exponer un decorador `@Public()` (`SetMetadata`) para opt-out explícito en health (`GET /`). Eliminar los `@UseGuards` repetidos de los controllers.
- **Esfuerzo:** M
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### S-3. Rutas `(app)` de lectura sin guard server-side de rol: solo `requireSession` + ocultación cosmética del sidebar *(D5 — duplicado con U-5)*

- **Severidad:** Medium
- **Evidencia:** `producto/tract-front/src/app/(app)/layout.tsx:13` ejecuta solo `await requireSession()` (auth, sin rol); `require-role.ts:6-10` confirma que `requireSession` no valida rol. `tickets/page.tsx:14-22` y `reportes/page.tsx:9-11` no llaman `requireRole` (este último es síncrono, no puede redirigir server-side). Solo `/inventario/*`, `/usuarios` y `/taller/carga` aplican `requireRole`. El filtrado del menú por rol es 100% cliente (`app-sidebar.tsx` `filterByRole` sobre `sidebar-data.ts`). `proxy.ts`/`middleware.ts` solo refrescan sesión, sin lógica de rol.
- **Impacto:** Un mechanic que navega manualmente a `/tickets` carga el kanban (la API acota la lista del mechanic, pero igual sirve el listado a roles que el menú oculta); en `/reportes` la API responde 403 y la UI queda en estado "Acceso restringido" en vez de redirigir a su home. La autoridad de lectura recae 100% en la API (defense-in-depth/UX, no fuga de datos). Coincide con la nota de memoria "/tickets sin guard server-side".
- **Recomendación accionable:** Anteponer `await requireRole(...)` en cada page server-component según la matriz del API (tickets/ordenes/equipos/mantenciones/plantillas/reportes → admin+jefe_taller; marcas → admin), redirigiendo a `defaultRouteForRole`. Convertir `reportes/page.tsx` en `async`. **Centralizar la matriz ruta→roles** en un módulo único consumido por `filterByRole` y por el guard server-side para evitar drift.
- **Esfuerzo:** M
- **Roles afectados:** mechanic, jefe_inventario, jefe_taller, admin

---

#### S-4. RLS de defensa-en-profundidad inexistente para `jefe_inventario` en TODAS las tablas de inventario

- **Severidad:** Low
- **Evidencia:** `producto/trackt-api/supabase/migrations/20260618000000_role_jefe_inventario.sql` solo crea `profiles_select_jefe_inventario_same_tenant` (líneas 64-70); **ninguna** policy en `repuestos`/`inventario_stock`/`reservas_repuestos`/`reserva_repuesto_items`/`movimientos_inventario` (grep de `jefe_inventario` = solo ese archivo, todo sobre `profiles`). Las policies de `20260519100000_inventario.sql` son admin-only (`repuestos_write_admin:278-288`, `inventario_stock_write_admin:297-307`) o admin/jefe_taller (`reservas_select_admin_jefe:312-318`, `movimientos_select_admin_jefe:346-352`). La doctrina de defense-in-depth está documentada en `rls_policies_triggers.sql:8-13`.
- **Impacto:** Falla **cerrado** y no es alcanzable hoy: todo el I/O de inventario pasa por la API con `service_role` (bypassa RLS); grep de `.from('repuestos'|...)` en `tract-front/src` = 0. La asimetría es real (`inventario.controller.ts` autoriza `@Roles('admin','jefe_inventario')` en escrituras, líneas 41,68,79,92,104, pero RLS no lo espeja). Matiz: `repuestos_select_tenant` (274-276) e `inventario_stock_select_tenant` (293-295) abren SELECT a todo el tenant, así que el rol sí lee catálogo/stock; la denegación real aplica a WRITE y a SELECT de movimientos/reservas. Riesgo latente de disponibilidad si el front leyera inventario con el JWT del rol (realtime/consulta directa) → 403.
- **Recomendación accionable:** Agregar policies para `auth_role()='jefe_inventario'` espejando admin: SELECT y WRITE en `repuestos` e `inventario_stock`, SELECT en `movimientos` y `reservas_repuestos`/`reserva_repuesto_items`, según el alcance real del rol. Como mínimo, documentar formalmente que inventario renuncia a RLS para este rol.
- **Esfuerzo:** M
- **Roles afectados:** jefe_inventario

---

#### S-5. Matriz de `@Roles` incoherente sobre reservas: `jefe_inventario` autorizado a "liberar" pero el service lo bloquea con 403 (dead-end) *(D4 — raíz compartida con U-1 y U-3)*

- **Severidad:** Low *(como issue de seguridad; el impacto UX lo eleva a High — ver U-1/U-3)*
- **Evidencia:** `producto/trackt-api/src/inventario/reservas-repuestos.controller.ts:72` declara `@Roles('admin','jefe_taller','jefe_inventario','mechanic')` para `POST /reservas-repuestos/:id/liberar`, pero `liberarReserva` (`inventario.service.ts:840`) invoca `assertCanActOnTicket`, que (`inventario.service.ts:1065-1072`) solo retorna para admin/jefe_taller o mechanic-dueño → `jefe_inventario` cae en `throw new ForbiddenException('Sin acceso al ticket indicado')`. Asimétrico con `aprobar` (controller:100-110, **sí** incluye jefe_inventario y su service **no** llama `assertCanActOnTicket`) y con `consumir` (controller:84) y `findReservasByTicket`/`createReserva` (controller:42-70) que **no** lo incluyen.
- **Impacto (óptica seguridad):** El modo de falla es **sobre-restricción (fail-closed)**, no bypass: `jefe_inventario` pasa el `RolesGuard` pero el service garantiza 403 al liberar. No se concede nada indebido ni se expone/muta data; el "bypass conceptual" es débil. Queda un smell de consistencia/correctitud real (un rol en `@Roles` de `/liberar` que nunca puede tener éxito). El impacto operativo grave (rol gestor de stock bloqueado) se materializa en la dimensión UX.
- **Recomendación accionable:** Definir la política de `jefe_inventario` sobre reservas y **unificar controller + service**: si debe liberar, incluirlo en `assertCanActOnTicket` (o saltar el assert como en `aprobarReserva`); si no, removerlo del `@Roles` de liberar. Alinear `consumir`/`findReservasByTicket`/`createReserva` con la decisión.
- **Esfuerzo:** S
- **Roles afectados:** jefe_inventario

---

#### S-6. Asimetría de roles en `PATCH /ordenes/:id`: mechanic puede editar CUALQUIER OT del tenant (sin check de autoría) y jefe_taller queda excluido

- **Severidad:** Low
- **Evidencia:** `producto/trackt-api/src/ordenes/ordenes.controller.ts:92` declara `@Roles('admin','mechanic')` en `update()`, mientras `create/findAll/findOne/createTicket` (líneas 47,54,64,73,111) usan `@Roles('admin','jefe_taller','mechanic')`. `ordenes.service.ts:230-258` filtra solo por `{ id, tenantId }` (línea 232) y exige `estado === PENDIENTE` (238), **sin** comparar `creadoPorId` (campo que existe: seteado en `:150`, leído en `findOne:210`).
- **Impacto:** Authz incorrecta: un mechanic autenticado del mismo tenant puede modificar `descripcion`/`prioridad` de OTs ajenas en estado PENDIENTE; jefe_taller —que sí puede crear la OT— no puede editarla. Sin fuga cross-tenant ni escalada ni operación destructiva. Hoy inalcanzable por UI (`lib/api/ordenes.ts` no tiene wrapper PATCH); probable error de copy-paste del set de roles.
- **Recomendación accionable:** Alinear `@Roles('admin','jefe_taller')` en `PATCH /ordenes/:id` (o al set estándar de la entidad) y, si mechanic debe editar, agregar check de autoría (`creadoPorId === user.id`). Revisar la matriz de `@Roles` de endpoints análogos.
- **Esfuerzo:** S
- **Roles afectados:** mechanic, jefe_taller

---

#### S-7. Cache de perfil (rol+tenant) de 30s sin invalidación: ventana de privilegio tras revocación/cambio de rol

- **Severidad:** Low
- **Evidencia:** `producto/trackt-api/src/auth/profile.service.ts:19,46` cachea `{role, tenant_id, full_name}` por `userId` con `TTL_MS=30s`; `auth.guard.ts:34,42-43` deriva rol/tenant de la fila cacheada (no del JWT). `profile.service.ts:50-52` define `invalidate(userId)` pero **0 call sites** (grep `\.invalidate(` en `trackt-api/src` = sin matches).
- **Impacto:** Un downgrade de rol o cambio de tenant sigue surtiendo el valor viejo hasta 30s en la API. La ventana es **latente/inalcanzable hoy**: no hay endpoint ni flujo que mute rol/tenant de un usuario existente (`usuarios.controller.ts` solo `@Get()`; sin `@Patch/@Put/@Delete`; no hay flujo de off-boarding). `inviteUser` solo crea (sin cache previa); `updateProfile`/`uploadAvatar` solo tocan `full_name`/`avatar_url`. El defecto es real pero contingente a que se construya una feature de cambio de rol/expulsión.
- **Recomendación accionable:** Cablear `profiles.invalidate(userId)` en cualquier futuro flujo de mutación de rol/tenant (endpoint/evento), o reducir el TTL para operaciones sensibles, o autorizar leyendo `role`/`tenant` del claim `app_metadata` del JWT (revocación vía refresh de sesión).
- **Esfuerzo:** M
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### S-8. `auth/callback` no valida que `?next` sea ruta interna (open-redirect parcialmente mitigado) y no fuerza set-password para invitados

- **Severidad:** Low
- **Evidencia:** `producto/tract-front/src/app/(auth)/auth/callback/route.ts:7` toma `next = searchParams.get('next') ?? '/dashboard'` y `:24` redirige a `${origin}${next}` sin validar que empiece con `/` ni bloquear `//`/`/\`. `login()` (`auth.ts:16-26` `safeRedirectPath`) y el middleware **sí** validan; el callback no reusa esa validación. Además `inviteUser` (`users.ts:35-37`) llama `inviteUserByEmail` **sin** `redirectTo`, y el callback redirige a `/dashboard` sin encadenar `/reset-password` (a diferencia de `forgotPassword`, `auth.ts:93`).
- **Impacto:** La concatenación con `origin` mitiga el salto a host externo, pero `next='//evil.com'` produce `${origin}//evil.com` (protocol-like path-relative) y el patrón de no-validar es frágil. El gap de invitación deja al invitado potencialmente autenticado **sin contraseña definida** (dead-end de onboarding), distinto del flujo de reset que sí fuerza set-password.
- **Recomendación accionable:** Reusar `safeRedirectPath`/`isSafeInternalPath` (`startsWith('/') && !startsWith('//') && !startsWith('/\\')`) en `auth/callback` antes de construir la redirección, extrayéndolo a un util compartido (ver T-11). Pasar `redirectTo: ${origin}/auth/callback?next=/reset-password` en `inviteUserByEmail`.
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### S-9. Policy `reservas_select_mechanic_own` no re-verifica `tenant_id` del ticket en el `EXISTS` (asimetría frágil con evidencias/eventos)

- **Severidad:** Low
- **Evidencia:** `producto/trackt-api/supabase/migrations/20260519100000_inventario.sql:320-331` filtra la reserva por `tenant_id=auth_tenant_id()` (correcto) pero el subquery `EXISTS` sobre `tickets` solo valida `t.id = ticket_id AND t.mecanico_id = auth.uid()::text` (327-329), **sin** `t.tenant_id = auth_tenant_id()`. En contraste, `evidencias_select_mechanic_own` (`20260517200000:186-191`) y `eventos_select_mechanic_own` (`:262-267`) **sí** agregan `t.tenant_id`.
- **Impacto:** Hoy no hay fuga cross-tenant (la reserva ya está tenant-scoped y `ticket_id` es FK dentro del tenant); pero si un mecánico tuviera registros en >1 tenant o cambiara de tenant, el `EXISTS` sin tenant podría emparejar un ticket de otro tenant con el mismo `mecanico_id`. Patrón inconsistente que debilita la defensa-en-profundidad.
- **Recomendación accionable:** Agregar `AND t.tenant_id = public.auth_tenant_id()` al `EXISTS` de `reservas_select_mechanic_own` para uniformar con evidencias/eventos.
- **Esfuerzo:** S
- **Roles afectados:** mechanic

---

### (b) Convenciones / Arquitectura

---

#### C-1. Mutaciones de dominio (alta de usuarios, edición de perfil) viven en Server Actions del front escribiendo directo a Supabase, saltando la API NestJS y `authFetch` *(D6 — faceta de arquitectura; ver S-1 para el bug funcional)*

- **Severidad:** Medium
- **Evidencia:** `CLAUDE.md:51-55,67-68` define la arquitectura (autorización/dominio en NestJS `AuthGuard→RolesGuard`; el front llama vía `lib/api/*` sobre `authFetch`). Pero `producto/tract-front/src/app/actions/users.ts:33-56` (`inviteUser`) usa `createAdminClient()` (`service_role`, `admin.ts:6` con `import 'server-only'`) y escribe `admin.from('profiles').upsert(...)` directo; `UsuariosController` solo expone `@Get()` (`:23`; grep de `@(Post|Patch|Put|Delete)` en `src/usuarios` = sin matches). `profile.ts:45-48,95-98` también hace `supabase.from('profiles').update(...)` directo (cliente anon/SSR). La asignación de rol (decisión de autorización) ocurre en el front (`users.ts:52`).
- **Impacto:** La lógica de autorización del dominio identidades queda partida en dos planos (`RolesGuard` en API vs `requireRole` en Server Action) y mete `SUPABASE_SERVICE_ROLE_KEY` en el runtime de Next (server-only, patrón estándar — no es leak al browser, pero fragmenta el plano de authz). El backend pierde el control del alta/edición de usuarios y de la asignación de roles. Sin vulnerabilidad explotable; divergencia de una convención central documentada con impacto en mantenibilidad y localidad de autorización.
- **Recomendación accionable:** Mover crear/editar/asignar-rol a un módulo NestJS (`POST/PATCH /usuarios`) con `service_role` solo en backend, y que el front consuma vía `lib/api/usuarios.ts`. Dejar las Server Actions únicamente para auth de sesión (login/forgot/reset).
- **Esfuerzo:** L
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### C-2. Query de resúmenes de usuario duplicado: `TicketsService.fetchUserSummaries` replica el "punto único" de `ProfileService.getUserSummaries` (3 copias) *(D2)*

- **Severidad:** Medium
- **Evidencia:** `producto/trackt-api/src/auth/profile.service.ts:57-58` define el docstring fundacional: *"Punto único de acceso a profiles para nombres — no duplicar este query en los services"*; `:60-73` implementa `getUserSummaries`. `producto/trackt-api/src/tickets/tickets.service.ts:975-987` (`fetchUserSummaries`) ejecuta el `$queryRaw` **idéntico byte a byte** (`SELECT id::text AS id, full_name FROM public.profiles WHERE id = ANY(${userIds}::uuid[])`) y la misma forma de `Map`; su propio comentario `:967-970` lo admite. **Tercera copia** en `ordenes.service.ts:406-415` (su comentario `:403` dice "Mismo patrón que TicketsService.fetchUserSummaries"). La convención ya se respeta en `reportes.service.ts:293`, `ordenes-pdf.service.ts:144` y `programaciones-mantenimiento.service.ts:603` (inyectan `ProfileService`).
- **Impacto:** Tres fuentes de verdad para hidratar nombres de usuario, contra un invariante escrito que el resto del codebase respeta. Cualquier cambio (incluir email/avatar, migrar a Prisma) exige tocar 3 sitios con riesgo de desincronización.
- **Recomendación accionable:** Inyectar `ProfileService` en `TicketsService` y `OrdenesService`, y reemplazar `fetchUserSummaries` por `getUserSummaries`. **El wiring es gratis**: `AuthModule` es `@Global()` y exporta `ProfileService` (`auth.module.ts:7,10`), así que no requiere tocar imports de módulo. Aplica también al patrón `assertCanActOnTicket`/`ensureTicketAccess` reimplementado (ver T-3).
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, mechanic

---

#### C-3. Cliente Supabase de browser creado a nivel de módulo en `lib/api/mis-tickets.ts` — viola la regla lazy documentada en `http.ts` y `CLAUDE.md`

- **Severidad:** Medium
- **Evidencia:** `producto/tract-front/src/lib/api/mis-tickets.ts:3` (`import { createClient } from "@/lib/supabase/client"`) y `:6` (`const supabase = createClient();`) a nivel de módulo, usado en `getCurrentUserId()` (`:128`). `producto/tract-front/src/lib/api/http.ts:3-10` documenta e implementa lo contrario (comentario: un `createClient()` a nivel de módulo "se evaluaría en el servidor durante el build y lanzaría sin env de Supabase" → `getSupabase()` memoizado). `CLAUDE.md` (sección Frontend) reitera: "El cliente Supabase de browser se crea lazy — no crear clientes a nivel de módulo". Ironía: el mismo `mis-tickets.ts:2` importa el `authFetch` lazy de `http.ts`.
- **Impacto:** Violación de convención concreta en la ruta principal del rol mechanic. No es bug activo hoy (los `NEXT_PUBLIC_*` se inlinean en build → args truthy; el único importador de runtime es `hooks/use-mis-tickets.ts` con `"use client"`, y las demás referencias son `import type`). Pero los módulos `"use client"` **sí** se evalúan en Node durante SSR/prerender, así que el `createClient` corre server-side en cada render; es exactamente la mina latente que la convención existe para prevenir (envs ausentes en build, o un futuro import de símbolo no-type desde un Server Component — `tickets.ts:226` ya referencia `mis-tickets`).
- **Recomendación accionable:** Mover `createClient()` a un getter lazy (`let c; function getSupabase(){ return c ??= createClient() }`) usado dentro de `getCurrentUserId()`, espejando `http.ts:7-10`. Idealmente reusar el helper de `http.ts`.
- **Esfuerzo:** S
- **Roles afectados:** mechanic

---

#### C-4. El front colapsa la máquina de estados de `OrdenTrabajo` en la de `Ticket` (`OtEstado = TicketEstado`), forzando un mapeo de traducción y rótulos incorrectos *(D3 — raíz compartida con T-2)*

- **Severidad:** Medium
- **Evidencia:** `producto/trackt-api/prisma/schema.prisma:27-32` define `OrdenTrabajoEstado = PENDIENTE|EN_PROCESO|CERRADA|CANCELADA` (distinto de `TicketEstado :34-41`). `producto/tract-front/src/components/core/types.ts:40` define `export type OtEstado = TicketEstado;` (y contamina `TracktEstado`, `:42`, usado por `StatusBadge`). Por eso `ordenes.ts:51-65` (`adaptOrdenEstado`) traduce `EN_PROCESO→EN_EJECUCION`, `CERRADA→CERRADO`, `CANCELADA→CANCELADO` (load-bearing: `ordenes.test.ts:26-49` lo asevera). `status-badge.tsx:30-37,46-52` solo tiene claves `EN_EJECUCION`/`CERRADO`; se usa para OTs en `ot-card.tsx:32`, `orden-detalle-client.tsx:99,189`, `dashboard-admin.tsx:316`.
- **Impacto:** La OT pierde su identidad de dominio en el front: se exhiben estados de Ticket. Contraprueba decisiva: el **PDF** de la OT (`ordenes-pdf.service.ts:236`) imprime `Estado: ${ot.estado}` con el enum **crudo** (`EN_PROCESO`/`CERRADA`), así que la misma OT se rotula distinto en web vs PDF — inconsistencia observable entre superficies. El filtro de `ordenes-client.tsx:23-29` usa los valores ya traducidos y rompería si se moviera al backend.
- **Recomendación accionable:** Definir un `OtEstado` propio (`PENDIENTE|EN_PROCESO|CERRADA|CANCELADA`) con sus labels y un `StatusBadge` que acepte ambos enums, en vez de aliasarlo a `TicketEstado`. Eliminar `adaptOrdenEstado` y los mapeos inline duplicados (ver T-2).
- **Esfuerzo:** M
- **Roles afectados:** admin, jefe_taller, mechanic

---

#### C-5. `AuthGuard`/`RolesGuard` no registrados como `APP_GUARD` global *(D1 — ver S-2)*

- **Severidad:** Medium
- **Nota:** Mismo defecto que **S-2** (encuadrado como deuda arquitectónica / convención). Evidencia, impacto, recomendación y esfuerzo: ver S-2. Se cuenta **una vez** en el backlog.

---

#### C-6. `SupabaseService` no es `@Global()` y se re-provee por módulo: dos instancias separadas del cliente `service_role`

- **Severidad:** Low
- **Evidencia:** `SupabaseService` se declara en `providers` en dos módulos independientes: `producto/trackt-api/src/auth/auth.module.ts:9` y `producto/trackt-api/src/evidencias/evidencias.module.ts:8`. `producto/trackt-api/src/supabase.service.ts:9-19` no está marcado `@Global` ni vive en un módulo compartido exportado, por lo que cada `providers` crea su propia instancia (cada una con su admin client `service_role` lazy en `:30-44`).
- **Impacto:** Múltiples clientes Supabase `service_role` en el proceso (uno por módulo que lo declara). Desperdicio de conexiones/estado y ruptura del patrón de servicio compartido; al crecer, más módulos copiarán la línea de `providers`.
- **Recomendación accionable:** Mover `SupabaseService` a un módulo `@Global()` (o un `CommonModule` exportado) e importarlo donde se use, eliminando los `providers` duplicados de auth/evidencias.
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, mechanic

---

#### C-7. Comentarios/contrato de `profiles` obsoletos en `usuarios.service.ts` (2 roles, `tenant_id` "PENDIENTE TRA-17") contradicen el código real *(D7 — duplicado con T-12)*

- **Severidad:** Low
- **Evidencia:** `producto/trackt-api/src/usuarios/usuarios.service.ts:13` documenta `role TEXT CHECK (role IN ('admin','mechanic'))` (faltan `jefe_taller` y `jefe_inventario`, que existen: `src/auth/types.ts:1` define los 4 roles; migraciones `20260519000000` y `20260618000000`). `:18-19` marca `⚠ PENDIENTE: TRA-17 debe agregar tenant_id a profiles ... Sin esa columna la query filtrará 0 filas`, pese a que la migración `20260517000000_profiles_tenant_id.sql` ya creó la columna y `:69` ya filtra por `p.tenant_id`. Contradicción interna extra: el comentario dice `TEXT` pero `:72-75` castea `::user_role` (enum). El bloque `:1-23` entero describe un estado pre-migración superado.
- **Impacto:** La documentación inline del módulo de identidades miente sobre el conjunto de roles y el estado de la migración multi-tenant, en la lógica de autorización más sensible. Sin consecuencia de runtime (el código inmediato es correcto), pero induce a error a quien lea el comentario.
- **Recomendación accionable:** Actualizar/eliminar los comentarios TRA-14/TRA-17 de `usuarios.service.ts:1-23` para reflejar los 4 roles y que `tenant_id` ya está en `profiles`; idealmente consolidarlo con el modelado de `Profile` en Prisma (ver T-12).
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### C-8. Doc-comments de roles desfasados en `reservas-repuestos.controller.ts`: "Solo admin/jefe_taller" justo encima de `@Roles` que incluye `jefe_inventario`

- **Severidad:** Low
- **Evidencia:** `producto/trackt-api/src/inventario/reservas-repuestos.controller.ts:96-100`: el comentario de `aprobar()` dice "Solo admin/jefe_taller." seguido de `@Roles('admin','jefe_taller','jefe_inventario')`. Mismo desfase en `findPendientes()` `:112-118`. `inventario.service.ts:688` ("Roles: admin, jefe_taller") repite el error.
- **Impacto:** La documentación inline de la matriz de roles contradice los decoradores reales en endpoints sensibles de inventario. Induce a error sobre quién puede aprobar/listar reservas y dificulta razonar la autorización de `jefe_inventario`.
- **Recomendación accionable:** Actualizar los comentarios de `aprobar`/`findPendientes` (controller `:96-118`) y de `aprobarReserva` (service `:688`) para incluir `jefe_inventario`, manteniendo una sola fuente de verdad sobre roles.
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, jefe_inventario

---

### (c) Completitud de flujos / UX

---

#### U-1. `jefe_inventario` no puede completar su trabajo de punta a punta: su pantalla principal (Solicitudes pendientes) ofrece "Rechazar" que SIEMPRE da 403 *(D4 — ver S-5)*

- **Severidad:** High
- **Evidencia:** `producto/tract-front/src/app/(app)/inventario/reservas-pendientes/reservas-pendientes-client.tsx:36-51` (`handleRechazar` → `useLiberarReserva` → `POST /reservas-repuestos/:id/liberar`); el botón "Rechazar" (`:161-169`) está **siempre visible** junto a "Aprobar", sin gating de rol. El controller (`reservas-repuestos.controller.ts:72`) incluye `jefe_inventario`, pero `liberarReserva` (`inventario.service.ts:840`) → `assertCanActOnTicket` (`:1065-1072`) lanza `ForbiddenException` para el rol. `/inventario/reservas-pendientes` es la landing-adyacente del rol (`default-route.ts:12 → /inventario`; `page.tsx:12` `requireRole` incluye `jefe_inventario`). Asimetría confirmada: `aprobarReserva` (`:694-790`) **no** llama `assertCanActOnTicket`, así que Aprobar sí funciona.
- **Impacto:** El rol cuyo propósito central es aprobar/**rechazar** solicitudes solo puede aprobar; rechazar (su otra decisión natural en su cola) falla con toast genérico "No se pudo rechazar la solicitud" sin explicación accionable. Debe escalar a un admin. Flujo nuclear roto en la pantalla más usada del rol, sin workaround in-app.
- **Recomendación accionable:** Decidir la política: si `jefe_inventario` debe rechazar/liberar, incluirlo en `assertCanActOnTicket` (`:1069`) o saltar el assert como en `aprobarReserva`; si no, quitar `jefe_inventario` del `@Roles` de liberar (`controller:72`) y ocultar el botón "Rechazar" para este rol. **Unificar la matriz aprobar/liberar/consumir.**
- **Esfuerzo:** S
- **Roles afectados:** jefe_inventario

---

#### U-2. Cancelar y editar OT son dead-ends: capacidades de backend sin UI ni wrapper; no hay forma de destrabar una OT atascada

- **Severidad:** High
- **Evidencia:** `producto/tract-front/src/app/(app)/ordenes/[id]/orden-detalle-client.tsx:108-122` solo expone "Descargar PDF" y "Crear ticket" (replicado `:224` "Agregar"); sin botón cancelar/editar. `producto/tract-front/src/lib/api/ordenes.ts` solo exporta `getOrdenes/getOrdenById/descargarPdfOrden/createOrden` (sin `cancelarOrden`/`updateOrden`); `hooks/use-ordenes.ts` sin mutation hook de cancel/edit. El backend **sí** expone `POST /ordenes/:id/cancelar` (`ordenes.controller.ts:103`, **`@Roles('admin')`**) y `PATCH /ordenes/:id` (`:92`, **`@Roles('admin','mechanic')`**). `ordenes.service.ts:269-337` (`cancelar`) hace cascada de cancelar tickets PENDIENTE + libera reservas vía `inventario.liberarReservasDeTicket`.
- **Impacto:** Una OT mal creada es inmutable desde la app. **Peor:** una OT atascada (ticket que nunca cierra) deja reservas de inventario bloqueadas y la única salida documentada (cancelar la OT) es inalcanzable desde la UI → requiere SQL manual (o llamada directa a la API con token admin). El editar es de bajo impacto (solo PENDIENTE, cosmético); el **cancelar** es lo que sostiene la severidad high. *Corrección de roles vs el hallazgo original:* PATCH es admin+mechanic (no jefe_taller); cancelar es admin-only.
- **Recomendación accionable:** Agregar en `lib/api/ordenes.ts` los wrappers `cancelarOrden()`/`updateOrden()` + hooks `useCancelarOrden`/`useUpdateOrden`; exponer en `orden-detalle-client.tsx` un botón "Cancelar OT" (gated **admin**, con diálogo de confirmación) y un form de edición (gated admin+mechanic) habilitado solo en estado PENDIENTE, invalidando `['ordenes']` y `['ordenes', id]`.
- **Esfuerzo:** M
- **Roles afectados:** admin (cancelar/editar), mechanic (editar)

---

#### U-3. `ReservasSection` ofrece a `jefe_inventario` acciones que el backend rechaza (Consumir/Liberar) y ni siquiera puede cargar las reservas del ticket (403) *(D4 — ver S-5/U-1)*

- **Severidad:** High
- **Evidencia:** `producto/tract-front/src/components/inventario/reservas-section.tsx:58` (`canManageReserva = isAdmin || isJefe || isJefeInventario`), `:66` (`canModifyReserva`), `:154-155` (`canActOnReservada`) renderiza "Consumir" (`:181-189`) y "Liberar" (`:190-198`) para `jefe_inventario`. Backend: `consumir` (`controller:84`) **no** incluye el rol → 403; `liberar` lo rechaza en el service (`assertCanActOnTicket`). El data-fetch `useReservasByTicket` → `GET /tickets/:id/reservas-repuestos` (`controller:58`) tampoco incluye `jefe_inventario` → 403 → EmptyState "No se pudieron cargar las reservas del ticket" (`:135-141`). **Ruta in-app real:** `reservas-pendientes-client.tsx:141-147` enlaza `<Link href={/tickets/${reserva.ticketId}}>`, y `tickets/[id]/page.tsx` no tiene `requireRole`, así que el rol aterriza en el detalle donde la sección falla.
- **Impacto:** Doble dead-end alcanzable in-app: la sección no carga (403) y, si cargara, los botones fallan. La UI promete capacidades que el rol no tiene → errores y confusión. Inconsistente con un rol que sí aprueba reservas (pero solo desde la cola global).
- **Recomendación accionable:** Alinear front y backend: (a) excluir `jefe_inventario` de `canManageReserva`/`canModifyReserva` en `reservas-section.tsx` (dejándolo solo en la cola de `reservas-pendientes`), o (b) agregar `jefe_inventario` a `@Roles` de `consumir`, `liberar` y `findReservasByTicket` si debe operar a nivel de ticket. Definir explícitamente el alcance del rol sobre reservas.
- **Esfuerzo:** M
- **Roles afectados:** jefe_inventario

---

#### U-4. `jefe_inventario` no puede asignar marca al crear/editar repuestos: el dropdown de marca da 403 y muestra error

- **Severidad:** Medium
- **Evidencia:** `producto/tract-front/src/components/inventario/repuesto-form-sheet.tsx:8,307-317` renderiza `<MarcaSelect>` (vía `<Controller name="marcaId">`), que consume `GET /marcas`. Pero `producto/trackt-api/src/marcas/marcas.controller.ts:38` declara `@Roles('admin','jefe_taller','mechanic')` — **omite `jefe_inventario`**. El rol sí gestiona repuestos: `POST/PATCH /inventario/repuestos` tienen `@Roles('admin','jefe_inventario')` (`inventario.controller.ts:41,68,79`). El rol abre el sheet (`inventario/page.tsx:13` `requireRole` lo admite; `inventario-client.tsx:56,466`); `MarcaSelect.tsx:38,107-111` renderiza "No se pudieron cargar las marcas." al 403.
- **Impacto:** El rol responsable del catálogo de repuestos abre el form y el selector de marca falla con 403. `marcaId` es **opcional** (schema `:39`), así que puede guardar el repuesto sin marca — el flujo no está duro-bloqueado, pero un campo de negocio central queda inaccesible justo para el rol que más lo necesita.
- **Recomendación accionable:** Agregar `jefe_inventario` al `@Roles` de `GET /marcas` (`marcas.controller.ts:38`) — es solo lectura de catálogo, sin riesgo. Verificar que `MarcaSelect` maneje carga/error con mensaje útil.
- **Esfuerzo:** S
- **Roles afectados:** jefe_inventario

---

#### U-5. Rutas de negocio protegidas sin guard server-side de rol: `/tickets`, `/ordenes`, `/reportes`, `/equipos`, `/marcas`, `/plantillas`, `/mantenciones` solo hacen `requireSession` *(D5 — ver S-3)*

- **Severidad:** Medium
- **Nota:** Mismo defecto que **S-3**, encuadrado desde UX (inconsistencia de comportamiento de navegación: unas rutas redirigen, otras muestran lista parcial, otras "Acceso restringido"). Evidencia/recomendación: ver S-3. Detalle adicional verificado: existe `ordenes-trabajo/page.tsx` que reexporta `/ordenes` sin guard, ampliando la brecha (ver T-9). Se cuenta **una vez** en el backlog.
- **Esfuerzo:** M
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### U-6. Botones "Subir foto" y "Finalizar" en la lista `/mis-tickets` no ejecutan nada: son enlaces al detalle (affordance engañosa para el mecánico)

- **Severidad:** Medium
- **Evidencia:** `producto/tract-front/src/app/(app)/mis-tickets/mis-tickets-client.tsx` (`TicketAction`): para estado ≠ ASIGNADO ambos botones son `<Button render={<Link href={/mis-tickets/${ticket.id}} />}>` (`:51-64`), sin `onClick`/mutación. TODO explícito (`:50`): "Subir foto debería auto-abrir input via `?action=upload`". "Finalizar" lleva al detalle donde además se exige ≥1 evidencia (`mi-ticket-detalle-client.tsx:156-160`; `canFinish` deshabilita el botón). El detalle **no** tiene handler de `?action=upload`. Contraste: la rama ASIGNADO (`:24-46`) sí tiene `onClick` real (`iniciar.mutateAsync`).
- **Impacto:** En la superficie principal (mobile) del mecánico, "Finalizar"/"Subir foto" prometen una acción y solo navegan. Friction (un tap oculto), no dead-end (el destino guía bien: "Cámara / Galería", "Sube al menos una foto"). La etiqueta mislabela una acción terminal en el flujo de terreno más crítico del rol.
- **Recomendación accionable:** O implementar el deep-link `?action=upload` que auto-dispara el file input en el detalle (y un equivalente para finalizar que abra el dialog), o renombrar los botones de la lista a "Abrir"/"Ver ticket".
- **Esfuerzo:** S
- **Roles afectados:** mechanic

---

#### U-7. Botones de estado operativo en la ficha QR se muestran sin gating de rol; mensaje "Equipo no encontrado" engañoso para `jefe_inventario`

- **Severidad:** Low
- **Evidencia:** `producto/tract-front/src/components/equipos/qr/equipo-qr-client.tsx:167-189` renderiza la grilla "Estado operativo" **sin** condición de rol; `handleCambiarEstado` (`:84`) → `PATCH /equipos/:id/estado-operativo` (`equipos.controller.ts:108`, `@Roles('admin','jefe_taller','mechanic')`). En contraste, "Reportar falla" **sí** se gatea (`canReportar`, `:81-82`, render `:192`). `jefe_inventario` no resuelve el equipo: `GET /equipos/qr/:qrToken` (`controller:50`) lo excluye → ve "Equipo no encontrado" (`:61-72`), mensaje engañoso (es por rol, no por tenant). La página QR no tiene `requireRole`.
- **Impacto:** Caveat de alcanzabilidad: ambos endpoints (qr-resolve y estado-operativo) tienen el **mismo** `@Roles`, así que el único rol excluido (`jefe_inventario`) nunca llega a ver los botones (cae antes en "Equipo no encontrado"). El escenario titular "pulsa estado operativo → 403" **no es alcanzable hoy**. Lo realmente vivo: (1) `jefe_inventario` ve un dead-end con mensaje inexacto (diagnosticabilidad), (2) la sección sin gate de rol es riesgo estructural latente (mordería si un futuro rol se agrega al qr-resolve pero no a estado-operativo).
- **Recomendación accionable:** Gatear la sección de estado operativo con el mismo criterio que `canReportar`. Distinguir el caso 403-por-rol de 404-por-tenant en "Equipo no encontrado". Decidir si `jefe_inventario` debe ver la ficha QR en read-only (y si sí, agregarlo a `@Roles` de la resolución QR).
- **Esfuerzo:** S
- **Roles afectados:** jefe_inventario

---

### (d) Redundancias / Deuda técnica

---

#### T-1. Boilerplate de cliente HTTP duplicado verbatim en 12 wrappers de `lib/api` (`assertApiBaseUrl`, `extractError`, `parseJsonResponse`, `API_BASE_URL`)

- **Severidad:** Medium
- **Evidencia:** `assertApiBaseUrl()` (cuerpo idéntico) en **12** wrappers: `equipos.ts:122`, `marcas.ts:40`, `tickets.ts:41`, `inventario.ts:172`, `plantillas.ts:76`, `programaciones.ts:75`, `mis-tickets.ts:93`, `notificaciones.ts:41`, `evidencias.ts:17`, `ordenes.ts:34`, `reportes.ts:18`, `usuarios.ts:14`. `const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL` en los mismos 12. `extractError(response, fallback)` en 6 (`equipos.ts:128`, `inventario.ts:178`, `marcas.ts:46`, `plantillas.ts:82`, `programaciones.ts:81`, `tickets.ts:250`). `parseJsonResponse<T>` en 3 (`ordenes.ts:40`, `tickets.ts:47`, `mis-tickets.ts:99`). `http.ts` solo exporta `authFetch`/`fetchWithToken` — **no** existe helper compartido para esto. Drift ya presente: `equipos.ts:129` tiene comentario que `marcas.ts:46` no; la lógica de `faltantes` está copiada en `inventario.ts:178-206` **y** `programaciones.ts:266-297` (`extractGenerarOtError`, byte-idéntico).
- **Impacto:** ~250–300 LOC duplicadas. Cualquier cambio en el contrato de error de Nest obliga a editar 6–12 archivos; el drift ya ocurre (3 copias de `faltantes`, divergencia de `parseJsonResponse`). Mantenimiento doble en toda la capa de datos del front.
- **Recomendación accionable:** Extraer a `lib/api/_shared.ts` (o `http.ts`): `API_BASE_URL` + `assertApiBaseUrl()`, `extractNestError(response, fallback)` con overload para `faltantes`, y `jsonOrThrow<T>(response, fallback)`. Reemplazar las copias por imports.
- **Esfuerzo:** M
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### T-2. Mapeo de estado de OT (backend→front) reimplementado en 3 lugares como fuentes de verdad divergentes *(D3 — raíz compartida con C-4)*

- **Severidad:** Medium
- **Evidencia:** `adaptOrdenEstado()` (`producto/tract-front/src/lib/api/ordenes.ts:51-65`, **no exportado**) mapea las 4 claves. Reimplementado inline como `mapOrdenEstado()` en `dashboard-admin.tsx:36-44` (usado `:316`). Además `ordenes-client.tsx:20-29` hardcodea los filtros con los valores **ya traducidos** (`EN_EJECUCION`/`CERRADO`/`CANCELADA`) con comentario erróneo (`:20-22` afirma "el backend solo emite estos cuatro"; el backend emite `EN_PROCESO`/`CERRADA`/`CANCELADA`, `schema.prisma:27-32`).
- **Impacto:** Tres dependencias del contrato OT-estado que pueden divergir. Escenario concreto: si el backend converge su enum (passthrough ya contemplado en `ordenes.ts:57-62`), `dashboard-admin.tsx:37-42` no tiene passthrough → caería a "PENDIENTE" para todo valor convergido, mal-etiquetando cada OT del dashboard. Efecto cosmético (texto/color), no corrupción de datos.
- **Recomendación accionable:** Exportar `adaptOrdenEstado` desde `lib/api/ordenes.ts` y consumirlo en `dashboard-admin.tsx` (borrar `mapOrdenEstado`) y en `ordenes-client.tsx` (derivar opciones de filtro del mapeo, no hardcodear). Corregir el comentario de `ordenes-client.tsx:20-22`. *(Se resuelve naturalmente al implementar C-4: un `OtEstado` propio elimina el mapeo de raíz.)*
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller

---

#### T-3. Patrón "traer todas las páginas" (fetch-all fan-out) copiado en 7 dominios; rechaza completo ante fallo parcial y no escala

- **Severidad:** Medium
- **Evidencia:** El bloque `const first = await fetchXPage(1,...); if (first.meta.totalPages <= 1) return ...; const restPages = Array.from({length: first.meta.totalPages-1}, (_,i)=>i+2); const rest = await Promise.all(restPages.map(...))` aparece en: `getMarcas` (`marcas.ts:86-94`), `getEquipos` (`equipos.ts:178-186`), `getAllTickets` (`tickets.ts:105-121`), `getOrdenes` (`ordenes.ts:91-99`), `getRepuestos` (`inventario.ts:240-250`), `getPlantillas` (`plantillas.ts:136-146`), `getProgramaciones` (`programaciones.ts:132-142`). No hay helper compartido (grep `fetchAllPages` = 0). El `Promise.all` rechaza todo si una página falla (`tickets.test.ts:73-77` lo asevera). Auto-documentado como deuda: `tickets.ts:106-111` `console.warn` si `>10 páginas` o `>1000`. El backend ya soporta filtros server-side (`list-tickets-query.dto.ts:5-19`) pero `tickets.ts:124-125` llama sin params y `tickets-client.tsx:127-138` filtra 100% client-side. `getRepuestos` se invoca desde 4 sitios (`repuesto-select.tsx:35`, `nueva-reserva-dialog.tsx:58`, `inventario-client.tsx:68`, `movimientos-client.tsx:91`).
- **Impacto:** 7 copias del algoritmo. En tenants grandes, N requests por montaje de lista (×4 para repuestos). Riesgo de latencia y **fallo total por una página caída** (sin resultado parcial). Filtrado/kanban client-side pese a soporte server-side existente.
- **Recomendación accionable:** Extraer `fetchAllPages(fetchPage, {limit})` en `lib/api` compartido. A medio plazo, mover filtrado/paginación a query params del backend (ya existen `estado`/`mecanicoId`/`otId`) y virtualizar, en vez de traer el universo completo.
- **Esfuerzo:** M
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### T-4. Endpoint + cliente + hook de cierre de ticket (`cerrar`) sin ningún consumidor de UI: segunda vía de cierre muerta

- **Severidad:** Medium
- **Evidencia:** `cerrar()` (`tickets.service.ts:599`, `controller:125` `@Roles('admin')`), `cerrarTicket` (`tickets.ts:308`) y `useCerrarTicket` (`use-tickets.ts:177`) implementados, pero grep de `useCerrarTicket`/`cerrarTicket` en `.tsx` = **0 consumidores** (solo definición + import propio). La vía real es `validar`: `transitions.ts` (fuente única declarada) no define acción "cerrar" (`EN_EJECUCION`/`EJECUTADO→CERRADO` mapea solo a `validar_aprobar`); `ticket-detalle-client.tsx:199-218` solo expone "Aprobar y cerrar"/"Rechazar". `cerrar()` duplica `validar(aprobado=true)` (misma cascada: `liberarReservasDeTicket` + `onTicketEstadoCambiado`).
- **Impacto:** Código muerto de extremo a extremo (servicio + endpoint + DTO + wrapper + hook + bloque de tests dedicado) que mantiene un segundo camino de cierre divergente del `validar` real. Endpoint admin-gated (inofensivo), pero genera ambigüedad sobre el cierre canónico y carga de mantenimiento.
- **Recomendación accionable:** Decidir: o exponer un botón "Cierre administrativo" (admin) en el detalle que consuma `useCerrarTicket`, o eliminar `cerrar()`/`cerrarTicket`/`useCerrarTicket` si `validar(aprobado=true)` ya cubre el caso.
- **Esfuerzo:** S
- **Roles afectados:** admin

---

#### T-5. Regla de autorización "puede actuar sobre ticket" (admin | jefe_taller | mechanic-dueño) duplicada en 3 servicios

- **Severidad:** Low
- **Evidencia:** `assertCanActOnTicket` (`inventario.service.ts:1065-1072`) y `ensureTicketAccess` (`evidencias.service.ts:202-221`, líneas 217-219 idénticas) reimplementan la misma regla; el filtro de scoping de mechanic en `tickets.service.ts:228,268` la aplica una tercera vez.
- **Impacto:** Mantenimiento triple de la regla de ownership/scoping. El bug de `jefe_inventario` en liberar (S-5/U-1) es síntoma directo: la regla no contempla roles nuevos uniformemente porque está copiada.
- **Recomendación accionable:** Extraer un helper compartido (`canActOnTicket(user, ticketMecanicoId)` / `assertCanActOnTicket(...)`) en `TenantService` o un nuevo `AccessService`, reutilizado desde inventario, evidencias y el filtro de tickets. Centralizar también qué roles aplican (resolvería de paso la inconsistencia de `jefe_inventario`).
- **Esfuerzo:** M
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### T-6. Lógica optimista de transición de ticket duplicada: `useIniciarTicketKanban` reimplementa `useTicketTransition`

- **Severidad:** Low
- **Evidencia:** `useTicketTransition` (`use-tickets.ts:82-126`) implementa `onMutate`/`onError`/`onSettled`; `useIniciarTicketKanban` (`:188-224`) repite el mismo ciclo casi verbatim (`:192,206,214`), según el comentario `:186-187` ("igual que `useTicketTransition` pero con el id en las variables de `mutate()`"). ~40 LOC duplicadas solo por dónde viene el `ticketId`.
- **Impacto:** ~40 LOC de cache/optimismo de React Query duplicadas. Un cambio en la estrategia de invalidación/rollback debe replicarse en ambos; riesgo de que el kanban quede desincronizado.
- **Recomendación accionable:** Generalizar `useTicketTransition` para aceptar el id en `mutate` (variante "idless") y reusarlo desde el kanban, eliminando `useIniciarTicketKanban`.
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, mechanic

---

#### T-7. `requireEquipo(tenantId, id)` duplicado en 2–3 servicios del módulo equipos

- **Severidad:** Low
- **Evidencia:** El guard `requireEquipo` (`findFirst {id,tenantId}` + NotFound) está en `equipos-repuestos.service.ts:115` y `equipos-plantillas.service.ts:108`, invocado 3 veces en cada uno (repuestos `:39,50,100`; plantillas `:38,49,93`). `EquiposService` ya hace lo equivalente inline en `findOne/update/desactivar` y se exporta desde `equipos.module.ts`.
- **Impacto:** Mismo guard existencia+tenant en 2–3 sitios; multiplica el punto de cambio si la regla de tenant-scoping evoluciona.
- **Recomendación accionable:** Exponer `EquiposService.assertExists(tenantId, id)` (o helper del módulo) y reutilizarlo desde `equipos-repuestos` y `equipos-plantillas`, borrando las copias privadas.
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller

---

#### T-8. Helper `buildResponse()` en `tickets.service.ts` sin call sites (código muerto)

- **Severidad:** Low
- **Evidencia:** `buildResponse(tx, ticketId)` se define en `producto/trackt-api/src/tickets/tickets.service.ts:932`; grep en `src` (excluyendo specs) solo arroja la definición, ninguna invocación. Todas las transiciones usan `loadTicketResponse()` (post-commit, fuera de tx).
- **Impacto:** Método privado muerto que sugiere una vía de respuesta dentro-de-tx inexistente; ruido en el contrato del servicio.
- **Recomendación accionable:** Eliminar `buildResponse()`, o documentar explícitamente para qué caso futuro se reserva.
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, mechanic

---

#### T-9. Ruta `/ordenes-trabajo` re-exporta `/ordenes`: dos URLs vivas para la misma vista

- **Severidad:** Low
- **Evidencia:** `producto/tract-front/src/app/(app)/ordenes-trabajo/page.tsx` contiene solo `export { metadata } from '../ordenes/page'; export { default } from '../ordenes/page';`. El sidebar (`sidebar-data.ts`) enlaza a `/ordenes`; `/ordenes-trabajo` queda como alias huérfano no enlazado.
- **Impacto:** Dos rutas vivas para la misma pantalla: duplica metadata, ensucia SEO/analytics y ninguna tiene `requireRole` server-side (amplía la brecha de S-3/U-5).
- **Recomendación accionable:** Si es legacy, reemplazar `/ordenes-trabajo` por un redirect permanente a `/ordenes` o eliminarlo.
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller

---

#### T-10. Dos hooks `useIsMobile` con breakpoints divergentes (768px vs 800px)

- **Severidad:** Low
- **Evidencia:** `producto/tract-front/src/hooks/use-mobile.ts` exporta `useIsMobile()` con `MOBILE_BREAKPOINT = 768`. `producto/tract-front/src/hooks/use-media-query.ts:94-95` exporta **otro** `useIsMobile()` que hace `return useMediaQuery('max-md')` con `BREAKPOINTS.md = 800` (`:10`). `sidebar.tsx` usa la variante de `use-media-query` (800).
- **Impacto:** Comportamiento "mobile" inconsistente según el import elegido (47px de diferencia). Bug latente de UI responsiva difícil de rastrear; el nombre idéntico facilita importar el equivocado.
- **Recomendación accionable:** Eliminar `use-mobile.ts` y reexportar `useIsMobile` desde `use-media-query.ts` con un único breakpoint móvil; actualizar imports.
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### T-11. Lógica anti open-redirect (safe internal path) triplicada con implementaciones distintas

- **Severidad:** Low
- **Evidencia:** El invariante "ruta interna segura" está implementado por separado en `auth.ts:16-26` (`safeRedirectPath`, cubre `/\`), `middleware.ts:16-21` y `:76-77` (`target.startsWith('/') && !target.startsWith('//')`, **no** chequea `/\`). Además `callback/route.ts` no reusa ninguna y construye `${origin}${next}` sin validar (ver S-8).
- **Impacto:** Tres reglas anti open-redirect que pueden divergir (la de middleware no chequea `/\`); la inconsistencia es la causa de que el callback OAuth quede sin validación. Mantenimiento y superficie de seguridad fragmentados.
- **Recomendación accionable:** Extraer `isSafeInternalPath(value)` único en `lib/` (cubriendo `/`, `//`, `/\`) y reusarlo en `safeRedirectPath`, middleware (ambos puntos) y el callback route. *(Cierra S-8 de paso.)*
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### T-12. Comentarios y contrato de `profiles` obsoletos: tabla núcleo multi-tenant fuera de `schema.prisma`, accedida por `$queryRaw` disperso + tipo `UsuarioRol` sin `jefe_inventario` *(D7 — superset de C-7)*

- **Severidad:** Low
- **Evidencia:** `public.profiles` (fuente de `role`+`tenant_id`) **no** está modelada en Prisma (grep en `schema.prisma` = 0); accedida por `$queryRaw` en `profile.service.ts:33,69,82`, `tickets.service.ts:979`, `usuarios.service.ts:92,108`. Comentarios obsoletos (ver C-7). Tipo divergente: `lib/api/usuarios.ts:3` `UsuarioRol = 'admin'|'jefe_taller'|'mechanic'` **omite** `jefe_inventario` (presente en `auth/types.ts:1`, `lib/auth/profile.ts:5-9`). `CLAUDE.md` (raíz, sección Auth) lista solo 3 roles.
- **Impacto:** El contrato del núcleo de autorización está disperso en strings SQL con docs/tipos desactualizados. *Refutación verificada del riesgo de "UI rota":* `usuarios/page.tsx` no usa `UsuarioRol` (define su propio `ProfileRow` con `UserRole` completo y `roleLabel`/`roleBadgeVariant` manejan `jefe_inventario`); `UsuarioRol` solo fluye por `getMecanicos` (filtra duro `mecanico`), así que `jefe_inventario` nunca pasa por ese tipo. Queda como **higiene de tipos/documentación de bajo impacto**, sin ruta de falla observable.
- **Recomendación accionable:** Modelar `Profile` en `schema.prisma` (`@@map('profiles')`, role enum, `tenant_id`, `full_name`) y centralizar el acceso reemplazando `$queryRaw` por `prisma.profile`. Actualizar/eliminar comentarios TRA-14/TRA-17, sincronizar `UsuarioRol` con `UserRole` (incluir `jefe_inventario`) y actualizar `CLAUDE.md`. *(Engloba C-7.)*
- **Esfuerzo:** M
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### T-13. Guards repetidos por controller en vez de `APP_GUARD` global *(D1 — ver S-2)*

- **Severidad:** Low *(facetado como deuda de configuración)*
- **Nota:** Mismo defecto que **S-2/C-5**. Se cuenta **una vez** en el backlog (con severidad Medium del encuadre de seguridad).

---

#### T-14. Constantes de avatar, función `initials()` y límites de checklist duplicados (front-front y front-backend)

- **Severidad:** Low
- **Evidencia:** Avatar: `profile.ts:9-10` (`MAX_AVATAR_BYTES = 2*1024*1024`, `ALLOWED_MIME`) vs `perfil-form.tsx:35-36` (`MAX_BYTES`/`ALLOWED`, mismos valores). `initials()` reimplementada en `perfil-form.tsx:38`, `usuarios/page.tsx:35` y `nav-user.tsx:12`. Checklist: `plantilla-form-sheet.tsx:29-30` (`MAX_PASOS=100`, `MAX_PASO_LEN=500`) duplica `plantillas-mantenimiento.service.ts:60-61` (`CHECKLIST_MAX_PASOS=100`, `CHECKLIST_MAX_LARGO_PASO=500`) **cross-stack** sin fuente compartida.
- **Impacto:** Validaciones de tamaño/MIME, formato de iniciales y límites de checklist en 2–3 lugares cada uno. Los límites de checklist cross-stack pueden divergir → rechazos "sorpresa" del backend. Drift garantizado a futuro.
- **Recomendación accionable:** Extraer `initials()` a `lib/utils` y las constantes de avatar a un módulo único reutilizado por la Server Action y el form. Para checklist, exponer los límites por config compartida o documentar el contrato de `metadata.checklist` como fuente única.
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### T-15. Enums con valores muertos no documentados como tales: `ReservaRepuesto.CANCELADA`, `MovimientoInventario.SALIDA`, `Ticket.CANCELADO` sin path de escritura *(D8)*

- **Severidad:** Low
- **Evidencia:** `schema.prisma` declara `TicketEstado.CANCELADO` (`:40`), `MovimientoInventarioTipo.SALIDA` (`:62`), `ReservaRepuestoEstado.CANCELADA` (`:74`) y `ProgramacionMantenimientoEstado.VENCIDA/COMPLETADA` (`:97-98`). Ningún path de producción los escribe; el comentario `:92` reconoce que `VENCIDA/COMPLETADA` "se setean en Fase 5" (no implementada). El front ofrece filtrar por `SALIDA`/`CANCELADO`, devolviendo siempre vacío.
- **Impacto:** El modelo expone estados/tipos inalcanzables que el front materializa como filtros/badges fantasma. Sin marcar "reservado para Fase X", el lector asume que son alcanzables → UI muerta y contrato confuso de las máquinas de estado.
- **Recomendación accionable:** Comentar explícitamente cada valor no-alcanzable (`// no escrito por código aún — Fase N`) o removerlos del enum y de los filtros del front hasta implementarlos. *(Relacionado con T-16 y U-7/chips fantasma.)*
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, jefe_inventario, mechanic

---

#### T-16. Tipos de notificación `OT_CREADA` / `OT_CERRADA` declarados y renderizados en el front pero nunca emitidos por el backend *(D8)*

- **Severidad:** Low
- **Evidencia:** grep de `OT_CREADA|OT_CERRADA` en `trackt-api/src` = ningún emit (cero call sites en `ordenes.service`). En el front sí están: `notificaciones-bell.tsx` y `notificaciones.ts` los referencian con iconos/labels dedicados. Los únicos emit reales son `TICKET_*`.
- **Impacto:** La UI promete notificaciones de creación/cierre de OT que nunca llegan; mantenimiento de iconos/labels/tipos para eventos inexistentes y expectativa de producto incumplida (a diferencia de tickets, que sí notifican).
- **Recomendación accionable:** Emitir `OT_CREADA` en `ordenes.service.create()`/`crearEnTx` y `OT_CERRADA` en `onTicketEstadoCambiado` al pasar la OT a CERRADA; o eliminar ambos valores del enum, el tipo TS y los iconos del bell.
- **Esfuerzo:** S
- **Roles afectados:** admin, jefe_taller, mechanic

---

## 3. Backlog priorizado

Ordenado por prioridad (severidad × impacto / esfuerzo). Duplicados agrupados: cada problema único aparece **una sola vez** (las referencias `Sx/Cx/Ux/Tx` indican las facetas consolidadas). **(QUICK WIN)** = alto impacto y bajo esfuerzo (S).

| # | Título | Dimensión | Severidad | Esfuerzo | Roles | Recomendación |
|---|---|---|---|---|---|---|
| 1 | `jefe_inventario`: Rechazar/Liberar reservas y sección de reservas dan 403 (flujo nuclear roto) **(QUICK WIN)** *(S-5+U-1+U-3)* | Seguridad / UX | High | S | jefe_inventario | Unificar matriz `@Roles` aprobar/liberar/consumir + incluir `jefe_inventario` en `assertCanActOnTicket` (o gatear UI). Alinear `findReservasByTicket`. |
| 2 | Cancelar OT sin UI: reservas bloqueadas sin remedio in-app *(U-2)* | UX / Completitud | High | M | admin, mechanic | Wrappers `cancelarOrden`/`updateOrden` + hooks + botón "Cancelar OT" (admin) y form de edición (PENDIENTE). |
| 3 | Guards no globales (`APP_GUARD` ausente): seguridad opt-in, `GET /` público *(S-2+C-5+T-13)* | Seguridad / Arquitectura | Medium | M | todos | Registrar `AuthGuard`+`RolesGuard` como `APP_GUARD` + decorador `@Public()`. |
| 4 | Rutas `(app)` sin `requireRole` server-side (solo `requireSession`) *(S-3+U-5)* | Seguridad / UX | Medium | M | todos | `requireRole(...)` por page + centralizar matriz ruta→roles compartida con `filterByRole`. |
| 5 | Edición de perfil falla en silencio: `profiles` sin policy RLS UPDATE **(QUICK WIN)** *(S-1)* | Seguridad / Multi-tenant | Medium | S | todos | Policy `profiles_update_self` fijando `role`/`tenant_id`; mover write a NestJS. |
| 6 | `jefe_inventario`: dropdown de marca da 403 al catalogar repuestos **(QUICK WIN)** *(U-4)* | UX / Completitud | Medium | S | jefe_inventario | Agregar `jefe_inventario` a `@Roles` de `GET /marcas` (solo lectura). |
| 7 | Identidades: alta/edición/asignación-rol en Server Actions saltando la API *(C-1)* | Arquitectura | Medium | L | todos | Módulo NestJS `POST/PATCH /usuarios` con `service_role` solo en backend; front vía `lib/api`. |
| 8 | Boilerplate HTTP duplicado en 12 wrappers `lib/api` *(T-1)* | Redundancia | Medium | M | todos | Extraer `assertApiBaseUrl`/`extractNestError`/`jsonOrThrow` a `lib/api/_shared.ts`. |
| 9 | Fetch-all fan-out copiado en 7 dominios; rechaza completo ante fallo parcial *(T-3)* | Redundancia | Medium | M | todos | `fetchAllPages(fetchPage,{limit})` compartido; mover filtros a query params del backend. |
| 10 | `OtEstado = TicketEstado`: rótulos de OT incorrectos + mapeo triplicado *(C-4+T-2)* | Arquitectura / Redundancia | Medium | M | admin, jefe_taller, mechanic | `OtEstado` propio con labels y `StatusBadge` multi-enum; eliminar `adaptOrdenEstado`/copias. |
| 11 | Cliente Supabase eager a nivel de módulo en `mis-tickets.ts` **(QUICK WIN)** *(C-3)* | Convención | Medium | S | mechanic | Getter lazy `getSupabase()` espejando `http.ts`. |
| 12 | Query `getUserSummaries` duplicado en 3 services (viola "punto único") **(QUICK WIN)** *(C-2)* | Convención / Redundancia | Medium | S | admin, jefe_taller, mechanic | Inyectar `ProfileService` (gratis vía `@Global()`) en Tickets/Ordenes; borrar copias. |
| 13 | Botones "Subir foto"/"Finalizar" en `/mis-tickets` no ejecutan (solo navegan) **(QUICK WIN)** *(U-6)* | UX | Medium | S | mechanic | Deep-link `?action=upload`/dialog, o renombrar a "Abrir"/"Ver ticket". |
| 14 | Stack de cierre `cerrar` ticket sin consumidor de UI (vía muerta) **(QUICK WIN)** *(T-4)* | Deuda técnica | Medium | S | admin | Exponer "Cierre administrativo" o eliminar `cerrar`/`cerrarTicket`/`useCerrarTicket`. |
| 15 | Regla "puede actuar sobre ticket" duplicada en 3 services *(T-5)* | Redundancia | Low | M | todos | Helper `assertCanActOnTicket` compartido (`AccessService`). |
| 16 | RLS defense-in-depth ausente para `jefe_inventario` en inventario *(S-4)* | Seguridad / Multi-tenant | Low | M | jefe_inventario | Policies espejando admin (SELECT/WRITE) o documentar renuncia a RLS. |
| 17 | Cache de perfil 30s sin invalidación (ventana latente) *(S-7)* | Seguridad | Low | M | todos | Cablear `invalidate()` en futura mutación de rol/tenant, o leer del JWT. |
| 18 | `Profile` fuera de Prisma + comentarios/tipos `jefe_inventario` desfasados *(C-7+T-12)* | Deuda técnica / Convención | Low | M | todos | Modelar `Profile` en `schema.prisma`; sincronizar `UsuarioRol`, comentarios y `CLAUDE.md`. |
| 19 | `PATCH /ordenes/:id`: mechanic edita OTs ajenas, jefe_taller excluido **(QUICK WIN)** *(S-6)* | Seguridad | Low | S | mechanic, jefe_taller | Alinear `@Roles('admin','jefe_taller')` + check `creadoPorId === user.id`. |
| 20 | `auth/callback` no valida `?next` ni encadena set-password de invitado **(QUICK WIN)** *(S-8)* | Seguridad | Low | S | todos | Reusar `isSafeInternalPath`; `redirectTo` a `/reset-password` en invite. |
| 21 | Lógica anti open-redirect triplicada (middleware no chequea `/\`) **(QUICK WIN)** *(T-11)* | Redundancia | Low | S | todos | `isSafeInternalPath` único en `lib/` (cierra #20). |
| 22 | `SupabaseService` no `@Global()`: clientes `service_role` duplicados **(QUICK WIN)** *(C-6)* | Convención | Low | S | admin, jefe_taller, mechanic | Mover a módulo `@Global()`; eliminar `providers` duplicados. |
| 23 | Policy `reservas_select_mechanic_own` sin `tenant_id` en el `EXISTS` **(QUICK WIN)** *(S-9)* | Seguridad / Multi-tenant | Low | S | mechanic | Agregar `AND t.tenant_id = public.auth_tenant_id()`. |
| 24 | Doc-comments de roles desfasados en reservas (`jefe_inventario`) **(QUICK WIN)** *(C-8)* | Convención | Low | S | admin, jefe_taller, jefe_inventario | Actualizar comentarios `aprobar`/`findPendientes`/`aprobarReserva`. |
| 25 | Comentarios `profiles` obsoletos (TRA-14/TRA-17) en `usuarios.service.ts` **(QUICK WIN)** *(C-7 — ver #18)* | Convención | Low | S | todos | Actualizar/eliminar bloque `:1-23` (4 roles, `tenant_id` ya existe). |
| 26 | `useIniciarTicketKanban` reimplementa `useTicketTransition` (~40 LOC) **(QUICK WIN)** *(T-6)* | Redundancia | Low | S | admin, jefe_taller, mechanic | Generalizar `useTicketTransition` a variante "idless". |
| 27 | `requireEquipo` duplicado en 2–3 services de equipos **(QUICK WIN)** *(T-7)* | Redundancia | Low | S | admin, jefe_taller | `EquiposService.assertExists(tenantId, id)` compartido. |
| 28 | Ficha QR: estado operativo sin gating de rol + mensaje engañoso **(QUICK WIN)** *(U-7)* | UX | Low | S | jefe_inventario | Gatear sección con `canReportar`; distinguir 403-rol de 404-tenant. |
| 29 | Constantes avatar/`initials()`/límites checklist duplicados **(QUICK WIN)** *(T-14)* | Redundancia | Low | S | todos | `initials()` a `lib/utils`; constantes/avatar y límites checklist a fuente única. |
| 30 | Dos `useIsMobile` con breakpoints divergentes (768 vs 800) **(QUICK WIN)** *(T-10)* | Redundancia | Low | S | todos | Eliminar `use-mobile.ts`; reexportar desde `use-media-query.ts`. |
| 31 | `buildResponse()` sin call sites (código muerto) **(QUICK WIN)** *(T-8)* | Deuda técnica | Low | S | admin, jefe_taller, mechanic | Eliminar o documentar el caso reservado. |
| 32 | `/ordenes-trabajo` re-exporta `/ordenes` (URL duplicada) **(QUICK WIN)** *(T-9)* | Deuda técnica | Low | S | admin, jefe_taller | Redirect permanente a `/ordenes` o eliminar. |
| 33 | Enums con valores muertos sin marcar (`CANCELADO`/`SALIDA`/`CANCELADA`...) **(QUICK WIN)** *(T-15)* | Deuda técnica | Low | S | todos | Comentar "Fase N" o remover del enum + filtros del front. |
| 34 | `OT_CREADA`/`OT_CERRADA` renderizados pero nunca emitidos **(QUICK WIN)** *(T-16)* | Deuda técnica | Low | S | admin, jefe_taller, mechanic | Emitir en `ordenes.service`/`onTicketEstadoCambiado`, o eliminar del enum+bell. |

> **Total problemas únicos en backlog:** 34 (los duplicados D1–D8 ya consolidados). **Quick wins:** 21 ítems (alto impacto relativo y esfuerzo S).

---

## 4. Mejoras deseables / nice-to-have

Separadas del backlog crítico: oportunidades de calidad sin defecto activo ni de seguridad. *(Algunas ya figuran como ítems low de deuda; aquí se enmarcan como mejora opcional, no obligación.)*

- **Modelar `Profile` en Prisma y retirar `$queryRaw` disperso (6 sitios).** Más allá de corregir comentarios (#18/#25), tipar la tabla núcleo multi-tenant da seguridad de tipos end-to-end y un punto único de acceso. Beneficio de mantenibilidad, no urgente.
- **Mover filtrado/paginación de listas al backend (server-side).** El backend ya tiene los DTOs (`list-tickets-query.dto.ts` con `estado`/`mecanicoId`/`otId`); migrar el filtrado client-side + virtualizar listas escalaría mejor en tenants grandes (complemento a #9).
- **Centralizar la matriz ruta→roles como fuente única** consumida por `filterByRole` (sidebar), el guard server-side (#4) y futuros checks. Previene drift entre lo que el menú oculta y lo que la API autoriza.
- **Implementar la cancelación de Ticket** (`POST /tickets/:id/cancelar` + acción UI) para que el estado `CANCELADO` deje de ser un chip fantasma (`tickets-client.tsx:39,249`) — alternativa "construir" frente a "ocultar" (#33). Solo si el producto requiere cancelar tickets individualmente.
- **`jefe_inventario` ve "Sin movimientos recientes" falso en el detalle del repuesto.** `inventario.service.ts:226` (`verMovimientos = admin || jefe_taller`) deja `movimientos = []` para `jefe_inventario`, pese a que `GET /inventario/movimientos` (`controller:118`) sí lo autoriza y el rol registra entradas/ajustes. Hay **tres criterios distintos** de "quién ve movimientos" para el mismo dato. *Recomendación (S):* incluir `jefe_inventario` en la condición de `findOneRepuesto:226` para unificar con `findAllMovimientos` y el gating del front. *(Bajo impacto: trazabilidad incompleta, no bloqueo; encaja como nice-to-have de consistencia.)*
- **Unificar `extractError` con manejo de `faltantes` y `parseJsonResponse`** en un solo helper con overloads (parte de #8), eliminando la 3.ª copia de la lógica de stock (`programaciones.ts:266-297`).
- **Onboarding de invitados con set-password forzado:** además de validar `?next` (#20), encadenar `/reset-password` tras la invitación evita el dead-end del invitado autenticado sin contraseña.

---

## 5. Notas de alcance

### 5.1 Qué se revisó (por código, estático)

- **Revisión estática completa del repositorio** `producto/trackt-api` (NestJS) y `producto/tract-front` (Next.js), incluyendo: controllers + `@Roles`/`@UseGuards`, services, guards (`AuthGuard`/`RolesGuard`/`ProfileService`), módulos y wiring de DI, `schema.prisma`, **todas las migraciones Supabase** (RLS policies, enums, triggers), Server Actions del front, `lib/api/*`, hooks de React Query, componentes de Uas y `CLAUDE.md`.
- **Cada hallazgo fue verificado adversarialmente**: se intentó refutar leyendo el código citado, rastreando grafos de import, grepeando call sites y buscando guards/filtros que el hallazgo pudiera haber pasado por alto. Las citas `archivo:línea` se confirmaron contra el árbol actual. Las severidades reflejan el ajuste **post-verificación** (varios `high` originales se bajaron a `medium`/`low` al demostrar que el impacto era latente, fail-closed o inalcanzable hoy; los 3 `high` que se sostienen son dead-ends de UX **alcanzables in-app**).
- **Alcanzabilidad de rutas/UI verificada** por grafo: importadores `"use client"` vs `import type`, gating de sidebar, `requireRole` por página, y enlaces in-app que conducen a pantallas con fallo (p.ej. `/inventario/reservas-pendientes → /tickets/:id`).

### 5.2 Qué NO pudo verificarse en vivo

- **Comportamiento de runtime contra producción:** la auth de prod **no es accesible vía `fetch`** desde este entorno de auditoría, por lo que **no** se ejecutaron requests autenticados reales contra la API ni se observaron respuestas 403/200 en vivo. Las conclusiones de runtime (p.ej. "RLS afecta 0 filas y devuelve `{ok:true}`", "el endpoint 403ea para `jefe_inventario`", "el fetch-all rechaza ante fallo parcial") se derivan de **lectura de código + semántica documentada de PostgreSQL RLS / Supabase JS / NestJS guards**, no de tráfico observado. Donde existían, se apoyaron en los **tests del repo** (`ordenes.test.ts`, `tickets.test.ts`, `tickets.service.spec.ts`) como evidencia corroborante del comportamiento esperado.
- **Estado real de la base de datos de prod:** no se inspeccionó la instancia Supabase desplegada (filas, policies efectivamente aplicadas, valores de enum en datos reales). El análisis de "enums con valores muertos" se basa en la **ausencia de paths de escritura en el código**, no en un conteo sobre la tabla.
- **Inlining efectivo de `NEXT_PUBLIC_*` en el build de Vercel:** se asumió el comportamiento estándar de Next (variables inlineadas en build) para razonar que C-3 es mina latente y no bug activo; no se inspeccionó un bundle de producción.
- **Métricas de carga/latencia reales** del patrón fetch-all (T-3): el impacto de escalado se infiere del algoritmo (N requests por `totalPages`) y del `console.warn` auto-documentado (`>10 páginas` / `>1000`), no de mediciones en un tenant grande real.

> Recomendación de cierre de alcance: validar en un entorno con auth accesible los 3 ítems high y los ítems S-1/S-4 (RLS) con requests autenticados por cada rol, para confirmar empíricamente los 403/no-ops antes de priorizar el fix.
