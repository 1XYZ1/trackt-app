# Convenciones de Industria — Trackt vs CMMS/EAM de referencia

> Contraste del diseño de Trackt contra convenciones del dominio CMMS/EAM y de arquitectura multi-tenant, con productos de referencia (MaintainX, Limble, IBM Maximo, Fiix). Cada área indica: **convención de industria** (con fuente) → **qué hace Trackt** → **veredicto** → **recomendación**, y cruza con el backlog de [`analisis-mejoras.md`](./analisis-mejoras.md).

## Nota de método y confianza

Este documento se generó con un `/deep-research` (fan-out de búsquedas → fetch de fuentes → verificación adversarial 3-votos → síntesis). **La corrida se cortó por límite de sesión** antes de terminar: se completaron el fetch y la extracción de claims, pero la verificación adversarial murió en la mayoría de claims y la síntesis automática no corrió. Esta síntesis es **manual** sobre los claims citados que sí se extrajeron. Confianza por claim:

| Marca | Significado |
|---|---|
| ✅ **Verificado** | Sobrevivió verificación adversarial (≥2 votos a favor, 0 en contra) |
| ⚠️ **Fuente única** | Claim extraído con cita textual de fuente autoritativa, pero la verificación no alcanzó a correr (rate-limit). Tratar como indicativo, no como hecho cerrado |
| ❌ **Refutado/contestado** | La verificación lo tumbó o hay contradicción entre fuentes — no usar como base |
| ⛔ **Sin datos** | La verificación no corrió y no hay claim citado — **pendiente de re-run** |

Las 11 preguntas de investigación se cubren con distinta profundidad: **fuerte en dominio CMMS (RQ1-5, RQ11)**, **débil en arquitectura interna multi-tenant (RQ6, RQ8, RQ9, RQ10)** — justo las áreas que más golpeó el rate-limit. Inicialmente sin datos por el corte; **cerrado en un re-run acotado** — ver §D.

---

## A. Dominio CMMS

### RQ1 — Split Orden de Trabajo → múltiples Tickets/Tasks

- **Convención de industria** ⚠️: el patrón de "una unidad de trabajo con sub-unidades" existe y es reconocido, pero la implementación canónica de Maximo **unificó tasks y work orders en la misma entidad**: las tasks viven en la misma tabla `WORKORDER`, distinguidas solo por un flag `ISTASK` (`Y`/`N`), no en una tabla separada [8]. Las tasks pueden tener su propio status y hasta subtasks [8].
  - ❌ *Contestado*: la idea de que Maximo usa "tres construcciones distintas (Child WO + Tasks + Multi-Asset)" como modelo canónico fue **refutada** (0-3) [9]. La realidad es el modelo unificado de [8].
- **Qué hace Trackt**: OT y Ticket son **entidades separadas con dos máquinas de estado distintas** (`ordenes_trabajo` + `tickets`). La OT agrupa tickets.
- **Veredicto**: **Desviación razonable**. Modelar trabajo jerárquico es estándar; separar en dos entidades es una variante legítima. El riesgo no es la separación sino la **duplicación de la máquina de estado** (la OT deriva su estado del de sus tickets) — exactamente el hallazgo **D3** del backlog (`OtEstado = TicketEstado` aliased + mapeo de estado de OT triplicado).
- **Recomendación**: mantener la separación OT/ticket (aporta agrupación real), pero **colapsar la lógica de estado de OT en un único punto derivado** de los tickets (cierra D3). Evaluar si la OT necesita estado propio persistido o puede ser 100% derivado.

### RQ2 — Estados canónicos de Work Order (¿falta On-Hold / Waiting Parts?)

- **Convención de industria** ⚠️: la secuencia canónica de Maximo es `WAPPR (Waiting for Approval) → APPR (Approved) → WMATL (Waiting for Materials) → INPRG (In Progress) → COMP (Completed) → CLOSE (Closed)` [10]. Incluye un estado dedicado **WMATL / "esperando materiales"** al que la WO entra tras aprobación cuando los repuestos aún no llegaron [10].
- **Qué hace Trackt**: OT = `PENDIENTE → EN_PROCESO → CERRADA (|CANCELADA)`. Ticket = `PENDIENTE → ASIGNADO → EN_EJECUCION → EJECUTADO → CERRADO (|CANCELADO)`.
- **Veredicto**: **GAP**. Faltan dos estados que la industria trata como first-class:
  1. **Estado de aprobación** (`WAPPR`): Trackt no tiene paso de aprobación de la OT/solicitud (ver RQ5, requester).
  2. **On-Hold / Esperando repuestos** (`WMATL`): Trackt tiene reservas de repuestos pero **no un estado "bloqueado por repuestos"**. Una OT/ticket que espera stock queda en `EN_PROCESO` sin señal.
- **Recomendación**: agregar estado `EN_ESPERA` / `ESPERANDO_REPUESTOS` al ticket (y reflejo en OT). Conecta directo con el backlog **#2** (cancelar OT con reservas bloqueadas): un ticket atascado por falta de repuesto debería ser visible y des-bloqueable, no un dead-end.

### RQ3 — Disparadores de mantenimiento preventivo

- **Convención de industria** ⚠️: la industria reconoce **5 tipos de disparador**: *breakdown, time-based, event-based, usage-based, condition-based* [11].
- **Qué hace Trackt**: Programaciones soportan **time-based** y **usage/meter-based** (por medidor).
- **Veredicto**: **GAP parcial / desviación razonable para v1**. Trackt cubre los 2 disparadores más comunes; faltan **event-based** y **condition-based** como opciones de primera clase.
- **Recomendación** (deseable, no crítico): dejar el modelo de Programaciones extensible a triggers por evento/condición (el `metadata Json?` ya permite extender sin migración). Priorizar bajo demanda real.

### RQ4 — Reserva de repuestos ↔ Work Order

- **Convención de industria** ⚠️: el ciclo materiales↔WO está reconocido a nivel de estado (Maximo `WMATL` espera materiales antes de ejecutar [10]). La práctica estándar implícita: el stock comprometido a una WO se libera si la WO no se ejecuta.
  - *Nota*: la corrida no extrajo una cita directa sobre "liberar reservas al cancelar". El principio (reservar→comprometer→consumir→**liberar en cancelación**) es razonamiento de diseño, no claim citado. Marcar como ⛔ pendiente de cita.
- **Qué hace Trackt**: stock `stockActual` / `stockReservado`, movimientos inmutables, reservas ligadas a tickets (`reservar → liberar/consumir`). **Pero** cancelar una OT con reservas las deja **bloqueadas** (requiere SQL manual) — backlog **#2 (HIGH)**.
- **Veredicto**: **Modelo correcto, comportamiento con GAP**. El modelo `actual/reservado` + movimientos inmutables es sólido y alineado. El gap es operacional: no hay liberación automática ni camino in-app al cancelar.
- **Recomendación**: en la transacción de cancelación de OT/ticket, **liberar (`LIBERACION`) toda reserva pendiente** del ticket. Cierra backlog #2. Idealmente atómico con la transición a `CANCELADO`.

### RQ5 — Taxonomía de roles (¿falta requester/solicitante?)

- **Convención de industria**:
  - ✅ **Verificado**: MaintainX define exactamente 3 roles default: **Requester, Full User, Administrator** [1] (voto 3-0).
  - ✅ **Verificado**: el rol **Requester** existe con el único propósito de **enviar solicitudes de trabajo** — "Requester accounts are designed for users to let the organization know about work that needs to be done" [1] (voto 2-0).
  - ⚠️ Un **work request es un artefacto distinto de un work order**: la solicitud es un pedido que management aprueba/rechaza, y se convierte en WO solo tras aprobación [2]. Los requesters incluyen gente **fuera del equipo de mantenimiento** [2].
  - ✅ **Verificado** / ⚠️: Limble **no** incluye un rol "requester" en su set base [5] (voto 2-0); lo maneja como **portal de solicitud sin login** (cualquiera puede enviar, sin RBAC) [6]. Su set base son ~3 roles: Technician / Manager / View Only [6].
  - ❌ *Refutado* (0-2): que Limble tenga 4 roles "Super User/Manager/Technician/View Only" — contradicho por [6].
- **Qué hace Trackt**: 4 roles operativos (`admin`, `jefe_taller`, `jefe_inventario`, `mechanic`). **No existe** concepto de *requester/solicitante* ni de *work request* distinto de la OT.
- **Veredicto**: **GAP (bien soportado por evidencia verificada)**. Toda OT en Trackt nace ya autorizada; no hay canal para que un operador/usuario externo *solicite* trabajo y alguien lo apruebe. Dos enfoques de industria válidos:
  1. **Rol Requester dedicado** (MaintainX) — 5º rol con permiso solo-crear-solicitud.
  2. **Portal de solicitud sin login** (Limble) — fuera del RBAC.
- **Recomendación**: introducir un **artefacto "Solicitud de trabajo"** (estado `SOLICITADA → APROBADA→ genera OT | RECHAZADA`) + un canal de entrada (rol `solicitante` o portal). Es un **gap de producto, no solo técnico** → agregar al backlog como ítem nuevo de alcance medio. Conecta con el estado de aprobación faltante de RQ2.

### RQ11 — UX de técnico en terreno (QR, foto, offline)

- **Convención de industria** ⚠️:
  - MaintainX asigna QR/barcodes a **assets, parts y locations**; el técnico escanea para **abrir la ficha** de esa entidad o **crear una WO** [3][4].
  - QR-scan, **modo offline** y captura de foto son tratados como capacidades **core mobile (deskless)**, exclusivas de la app móvil [4].
  - MaintainX ofrece **modo offline real**: el técnico sigue trabajando WOs y completando tasks sin internet [4].
- **Qué hace Trackt**: QR por equipo (`/q/[token]`) → ficha mobile; captura de evidencia fotográfica (signed-url → PUT → confirmar); transiciones de estado en vivo.
- **Veredicto**:
  - **QR**: **Alineado** — el patrón "escanear → ficha del activo" coincide con MaintainX. Mejora opcional: permitir desde el QR **iniciar una OT/ticket** (MaintainX escanea para poblar WOs).
  - **Foto**: **Alineado** (evidencias en Storage).
  - **Offline**: **GAP**. Trackt depende de conectividad (signed-url + transiciones en vivo). Un mecánico sin señal en terreno queda bloqueado.
- **Recomendación** (deseable): cola offline para evidencias + transiciones diferidas; o al menos degradar con gracia. Prioridad según realidad de cobertura de los talleres/terreno del cliente.

---

## B. Arquitectura multi-tenant

### RQ7 — NestJS: ¿APP_GUARD global vs @UseGuards por controller?

- **Convención de industria** ⚠️ (docs oficiales NestJS [7]):
  - Los guards son el mecanismo **oficial** de autorización (deciden si el request llega al handler según permisos/roles/ACL) [7] — valida el patrón `AuthGuard → RolesGuard` de Trackt.
  - NestJS soporta **3 scopes**: método y controller vía `@UseGuards()`, y **global** vía `useGlobalGuards()` o el token `APP_GUARD` [7]. El per-controller es un scope **sancionado, no una desviación**.
  - `APP_GUARD` es lo **recomendado para guards globales que necesitan inyección de dependencias** [7].
  - RBAC vía metadata (`@SetMetadata`/`Reflector`) + `RolesGuard` es exactamente el patrón `@Roles(...)` de Trackt [7].
- **Qué hace Trackt**: guards **opt-in por controller** (`@UseGuards`), **sin** `APP_GUARD` global. El patrón ya falló una vez: `GET /` quedó público (backlog **#3**).
- **Veredicto**: **Técnicamente alineado, pero frágil**. Per-controller es válido, pero es **auth opt-in**: un controller futuro que olvide `@UseGuards` nace sin protección. La industria respalda igual el global, que es **auth-by-default**.
- **Recomendación** (cierra backlog #3): mover a **`APP_GUARD` global** (`AuthGuard` + `RolesGuard` por defecto) con **`@Public()` para opt-out explícito**. Convierte el olvido en "ruta protegida de más" (falla segura) en vez de "ruta pública por accidente".

### RQ6 — RBAC vs ABAC: roles fijos vs permisos granulares (multi-tenant)

- **Convención de industria** [✅]: RBAC con un set fijo y pequeño de roles cubre la autorización de la **gran mayoría** de aplicaciones SaaS/B2B, en particular cuando los permisos se alinean con roles organizacionales estables — un enum de pocos roles **no es anti-patrón** sino la norma recomendada (✅ Auth0 [23]: *"RBAC provides strong authorization for most applications, particularly when user permissions align with defined organizational roles"*). La vía canónica es **empezar con RBAC y evolucionar a ABAC** solo cuando aparecen atributos/condiciones, no saltar a ABAC por defecto (✅ Permit.io [24]: *"Organizations often start by implementing their own RBAC and then gradually evolve it into ABAC as additional attributes are required"*).
- **Convención de industria — señales de migración** [✅]: el gatillo documentado para pasar a permisos granulares es la **role explosion** cuando el sistema cruza múltiples equipos, geografías o tenants (✅ Oso [25]: *"When systems span multiple teams, geographies, or tenants, RBAC can lead to role proliferation"*), o cuando entran datos **dinámicos/contextuales** (tiempo, ubicación, billing, estado) que no se pueden codificar como roles estáticos (✅ Permit.io [24]: *"When dynamic data points such as time, location, billing status, and current behavior come into effect - ABAC is unavoidable"*). La autoridad de authz, además, debe imponerse **server-side**: los checks client-side jamás deben ser decisivos porque son fáciles de bypassear (✅ OWASP [26]: *"Developers must never rely on client-side access control checks [...] they should never be the decisive factor [...] Access control checks must be performed server-side"*).
- **Qué hace Trackt**: 4 roles fijos vía `ENUM user_role` (`admin` / `jefe_taller` / `jefe_inventario` / `mechanic`) impuestos por `AuthGuard → RolesGuard` + `@Roles(...)` en la API NestJS; sin permisos granulares ni policies por atributo. El aislamiento por rol en el front (sidebar `filterByRole`) es cosmético; la decisión real es server-side.
- **Veredicto**: **Alineado** — para un CMMS single tenant-tier con responsabilidades estables (taller / inventario / mecánico / admin) los permisos **sí** se alinean con roles organizacionales, así que no introducir granularidad es una decisión defendible, no deuda técnica. Hoy Trackt no expone ninguna de las condiciones (horario, sucursal, ownership por-recurso, billing) que harían inevitable ABAC, por lo que RBAC fijo es la convención correcta.
- **Recomendación**: mantener RBAC fijo; vigilar criterios **falsificables** de migración a ABAC/permisos: (a) que cada tenant pida roles a medida (role explosion), o (b) reglas tipo *"editar solo OTs creadas por mí"*, *"acciones solo en horario de turno"*, *"acceso por sucursal"* o gating por estado de suscripción. **Riesgo residual (server-side):** OWASP exige que la decisión viva en el backend, pero en Trackt los guards son **opt-in por controller** (sin `APP_GUARD` global), así que la garantía depende de que ningún controller sensible omita `@UseGuards` — liga directo con el backlog **#3 / S-2** (registrar `APP_GUARD` global + `@Public()` para opt-out) en [`analisis-mejoras.md`](./analisis-mejoras.md).

### RQ8 — Protección server-side de rutas por rol en Next.js App Router

- **Convención de industria** [✅]: el middleware (renombrado **"Proxy"** en Next 16) **NO** es la frontera de autorización; sirve para checks *optimistas* rápidos sobre la cookie y nunca debe ser la única línea de defensa — el grueso de los checks va lo más cerca posible de la fuente de datos (✅ Next.js docs [16]: *"While Proxy can be useful for initial checks, it should not be your only line of defense in protecting your data. The majority of security checks should be performed as close as possible to your data source, see Data Access Layer for more information"*). Esta convención **no es nueva**: ya en v14 la doc oficial situaba el control en el Data Access Layer (✅ Next.js v14 [17]: *"the main security checks happen where your app accesses or changes data [...] middleware [...] should not be the sole line of defense [...] The bulk of security checks should be performed in the Data Access Layer"*).
- **Convención de industria — anti-patrones explícitos** [✅]: Next.js desaconseja authz en **Layouts** porque por Partial Rendering no se re-renderizan en cada navegación (✅ [16]: *"be cautious when doing checks in Layouts as these don't re-render on navigation [...] do the checks close to your data source or the component that'll be conditionally rendered"*), y marca como **no recomendado** el patrón SPA de *"return null en un top-level component"*, porque hay múltiples puntos de entrada (✅ [16]: *"This pattern is **not recommended** since Next.js applications have multiple entry points, which will not prevent nested route segments and Server Actions from being accessed"*). El blog de seguridad oficial codifica el principio Zero-Trust de re-leer el control en cada acceso a datos (✅ [18]: *"The principle is to always re-read access control and `cookies()` whenever reading data. Don't pass it as props or params"*).
- **Qué hace Trackt** (de [`analisis-mejoras.md`](./analisis-mejoras.md), S-3/U-5): `proxy.ts` solo refresca la sesión Supabase; varias rutas `(app)` (`/tickets`, `/ordenes`, `/reportes`, `/equipos`, `/marcas`, `/plantillas`, `/mantenciones`) hacen únicamente `requireSession` (no `requireRole`), dejando el aislamiento por rol **cosmético** (sidebar client-side). El backstop real es la API NestJS (`RolesGuard` + `@Roles` + scoping por `tenant_id` del JWT).
- **Veredicto**: **Desviación razonable** — que la navegación/aislamiento client-side sea cosmético **es aceptable y es el modelo canónico** siempre que exista un backstop server-side que aplique authz cerca de los datos; en Trackt ese backstop es la API, que es exactamente el rol que la doc asigna al DAL. Lo que **no** sería aceptable es que el único control fuera client-side o solo el proxy — y no es el caso. La desviación viva es de **UX/defensa-en-profundidad**, no de fuga: un `mechanic` carga el kanban de `/tickets`, y `/reportes` queda en "Acceso restringido" (403 de la API) en vez de redirigir a su home.
- **Recomendación**: anteponer `await requireRole(...)` server-side en cada page-component según la matriz del API (redirigiendo a `defaultRouteForRole`), y centralizar la matriz ruta→roles en un módulo único consumido por `filterByRole` y por el guard para evitar drift — backlog **#4 / S-3 / U-5**. Esto es defensa-en-profundidad y arreglo de UX, no la autoridad (que ya está, correctamente, en la API).

### RQ9 — RLS como defensa-en-profundidad con API service-role que bypassa RLS

- **Convención de industria** [✅]: el patrón de Trackt es **aceptado**, no anti-patrón, y descansa en dos mandatos complementarios. (1) El backend confiable **usa service-role precisamente para bypassar RLS** — es comportamiento documentado y esperado (✅ Supabase [12]: *"Supabase provides special \"Service\" keys, which can be used to bypass RLS [...] These should never be used in the browser or exposed to customers, but they are useful for administrative tasks"*; ✅ Supabase API keys [14]: la secret key *"uses the `BYPASSRLS` attribute, skipping any and all Row Level Security policies [...] You cannot use a secret key in the browser"*). A nivel de motor es un mecanismo de PostgreSQL, no una peculiaridad de Supabase (✅ PostgreSQL [13]: *"Superusers and roles with the `BYPASSRLS` attribute always bypass the row security system [...] Table owners normally bypass row security as well [...] unless ALTER TABLE ... FORCE ROW LEVEL SECURITY"*). (2) PERO **RLS debe seguir habilitada en TODA tabla del schema expuesto**, aunque el backend la bypasse, como defensa-en-profundidad (✅ Supabase [12]: *"RLS *must* always be enabled on any tables stored in an exposed schema [...] RLS is a Postgres primitive and can provide \"defense in depth\" to protect your data from malicious actors even when accessed through third-party tooling"*). Para el scoping multi-tenant, OWASP valida 1:1 el diseño de Trackt (✅ [15]: *"Get tenant from verified JWT claims - NOT from headers [...] Implement authorization checks at the data access layer, not just API layer [...] Use database-level isolation (RLS, schemas) as defense in depth"*).
- **Qué hace Trackt**: la API NestJS conecta como **service-role** (bypassa RLS por diseño); la autoridad real son `AuthGuard → RolesGuard` + scoping manual por `tenant_id` derivado del JWT en cada query Prisma. RLS de Supabase queda como defensa-en-profundidad para el cliente browser (anon key), que es contra quien sí actúa.
- **Veredicto**: **Alineado** — usar service-role para bypassar RLS y mantener la autoridad en la capa app es exactamente lo prescrito; la service_role nunca debe filtrarse al front (que opera con anon key), condición que el patrón documentado de Trackt respeta. **Caveat / riesgo residual:** como la API bypassa RLS, **RLS no es un backstop real para el backend** ([13]); si el scoping por `tenant_id` se omite en algún query/`updateMany`, no hay red a nivel DB para esa ruta. OWASP es explícito en que el enforcement debe vivir *"at the data access layer, not just API layer"* [15], es decir, sistemático en TODA operación Prisma — no opt-in.
- **Recomendación**: (1) verificar que **ninguna tabla del schema `public` expuesto vía PostgREST quede sin RLS habilitada** (el "must always be enabled" aplica aunque la API la bypasse) — conecta con los hallazgos de policies faltantes del backlog **S-4** (RLS de inventario ausente para `jefe_inventario`) y **S-9** (EXISTS sin re-chequear `tenant_id`) en [`analisis-mejoras.md`](./analisis-mejoras.md); (2) hacer el scoping por `tenant_id` sistemático/centralizado en la capa de datos, no confiable a la memoria por-query; (3) cerrar el write-path de identidades que escribe a Supabase fuera de NestJS (**C-1 / S-1**), para que la autoridad de tenancy no quede partida entre planos.

### RQ10 — Optimistic locking / state-machine contra TOCTOU en transiciones

- **Convención de industria** [✅]: la mitigación idiomática de transiciones concurrentes es el **compare-and-set (CAS) atómico en la DB**: un `UPDATE` condicional con el estado/versión esperado en el `WHERE`, seguido de verificar las filas afectadas; si `count==0` hubo conflicto → 409/retry. Es el patrón que la doc oficial de Prisma describe como **Optimistic Concurrency Control** (✅ Prisma [19]: *"Optimistic concurrency control (OCC) is a model for handling concurrent operations on a single entity that does not rely on locking"*; el código de ejemplo: *"Only mark the seat as claimed if the availableSeat.version matches the version we're updating"*). Encaja en literatura de patrones reputada: es el **Optimistic Offline Lock** de Fowler (✅ [22]: *"Optimistic Offline Lock solves this problem by validating that the changes about to be committed by one session don't conflict with the changes of another session"*), primera elección cuando el conflicto es raro. La causa raíz que previene es **TOCTOU / CWE-367** (✅ MITRE [21]: *"the resource's state can change between the check and the use in a way that invalidates the results of the check"*), cuya guía es fusionar check+use en un statement atómico.
- **Convención de industria — por qué es correcto en este stack** [✅]: bajo `READ COMMITTED` (default de PostgreSQL/Supabase), cuando dos transacciones actualizan la misma fila, el motor **re-evalúa el `WHERE` contra la versión ya commiteada**; si el estado cambió, el segundo updater no toca la fila → `count=0` (✅ PostgreSQL [20]: *"The search condition of the command (the `WHERE` clause) is re-evaluated to see if the updated version of the row still matches the search condition"*). Esto hace el CAS sobre la columna de estado atómico y determinista **sin necesidad de `SELECT FOR UPDATE` explícito** ni de una version column separada, para una transición gobernada por una sola columna.
- **Qué hace Trackt**: transiciones de ticket/OT vía `updateMany` con el estado esperado en el `WHERE` y `count !== 1 → 409`. Para la generación del **código de OT** usa el mecanismo complementario (advisory/pessimistic lock para serializar la secuencia).
- **Veredicto**: **Alineado** — el `UPDATE ... WHERE id=? AND status=esperado` + check de `count` es el OCC canónico de Prisma [19] y la mitigación de CWE-367 de MITRE [21]; la columna `status` cumple el rol del *concurrency token*, por lo que Trackt **no necesita** una version column separada mientras el espacio de estados sea un DAG (cada transición parte de un estado previo bien definido). Falsifica la objeción de que "haría falta `SELECT FOR UPDATE`": la garantía de re-evaluación del `WHERE` bajo READ COMMITTED [20] lo hace innecesario. Y el uso de lock pesimista justo donde corresponde (secuencia de código de OT) demuestra que Trackt aplica cada familia (optimista/pesimista) en su lugar.
- **Recomendación**: ninguna acción correctiva — patrón idiomático y seguro. Único criterio de revisión a futuro: si en alguna ruta el conflicto de transición pasara a ser **frecuente** o se necesitara **reservar la fila durante una transacción larga multi-paso**, ahí la alternativa correcta sería pesimista (`SELECT FOR UPDATE` / advisory lock) [22], no un cambio del CAS actual.

---

## C. Resumen de veredictos

| RQ | Área | Veredicto | Acción / Backlog |
|---|---|---|---|
| 1 | OT → tickets (split) | Desviación razonable | Colapsar lógica de estado OT (D3) |
| 2 | Estados de WO | **GAP** | Añadir `EN_ESPERA`/aprobación (liga #2) |
| 3 | Triggers PM | GAP parcial | Deseable: event/condition-based |
| 4 | Reservas ↔ WO | Modelo OK, comportamiento GAP | Liberar reservas al cancelar (**#2 HIGH**) |
| 5 | Roles / requester | **GAP (verificado)** | Nuevo ítem: artefacto Solicitud + requester |
| 6 | RBAC multi-tenant | **Alineado** | Mantener RBAC fijo; vigilar role-explosion/ABAC. Liga #3 (APP_GUARD global) |
| 7 | NestJS guards | Alineado pero frágil | `APP_GUARD` global + `@Public` (**#3**) |
| 8 | Next route-guards | **Desviación razonable** | `requireRole` server-side por ruta (defensa-en-profundidad/UX) — **#4 / S-3** |
| 9 | RLS vs service-role | **Alineado** | RLS on en toda tabla expuesta + scoping `tenant_id` sistemático (S-4/S-9/C-1) |
| 10 | TOCTOU / locking | **Alineado** | Sin acción: OCC idiomático (CAS en WHERE + count). Pesimista solo si conflicto frecuente |
| 11 | UX mobile terreno | QR/foto alineado, offline GAP | Deseable: modo offline |

**Hallazgos nuevos de producto (no estaban en el backlog técnico):**
- **Solicitud de trabajo + requester** (RQ5) — flujo de entrada de trabajo ausente, bien respaldado por industria.
- **Estado "esperando repuestos / on-hold"** (RQ2/RQ4) — señal operativa faltante.
- **Modo offline para terreno** (RQ11) — capacidad core mobile en CMMS líderes.

## D. Cobertura de investigación

Las 4 preguntas de arquitectura (RQ6, RQ8, RQ9, RQ10) que el primer `/deep-research` dejó **sin datos** (corte por límite de sesión) se **cerraron en un re-run acotado** (4 investigadores web + verificación adversarial 2-votos + síntesis; 45 agentes, sin re-tope). Sus veredictos y fuentes `[12]+` ya están integrados en §B. Resultado: **las 11 preguntas quedan cubiertas con evidencia citada.**

## Fuentes

| # | Fuente |
|---|---|
| [1] | MaintainX — User roles & permissions · https://help.getmaintainx.com/user-roles-and-permissions |
| [2] | MaintainX — Work request (learning center) · https://www.getmaintainx.com/learning-center/work-request |
| [3] | MaintainX — QR codes & barcodes · https://help.getmaintainx.com/about-qr-codes-and-barcodes |
| [4] | MaintainX — Mobile vs web overview · https://help.getmaintainx.com/mobile-vs-web-overview |
| [5] | Limble — User roles · https://help.limblecmms.com/en/articles/2991947-the-different-user-roles-in-limble |
| [6] | Limble — Permissions library · https://help.limblecmms.com/en/articles/8583797-limble-permissions-library |
| [7] | NestJS — Guards (docs oficiales) · https://docs.nestjs.com/guards |
| [8] | Maximo Times — Work order operations are now tasks · https://www.maximotimes.com/maximo/links/work-order-operations-are-now-tasks-fa/ |
| [9] | IBM — Child work orders, tasks, multi-asset · https://www.ibm.com/support/pages/when-use-child-work-orders-tasks-and-multi-asset-location-table-work-orders |
| [10] | Maximo Inside Out — Work order status flow · https://maximoinsideout.blogspot.com/2015/09/work-order-status-flow.html |
| [11] | Fiix — Maintenance triggers glossary · https://fiixsoftware.com/glossary/maintenance-triggers/ |
| [12] | Supabase — Row Level Security (Postgres) · https://supabase.com/docs/guides/database/postgres/row-level-security |
| [13] | PostgreSQL — Row Security Policies (ddl-rowsecurity) · https://www.postgresql.org/docs/current/ddl-rowsecurity.html |
| [14] | Supabase — API Keys (secret key / BYPASSRLS) · https://supabase.com/docs/guides/api/api-keys |
| [15] | OWASP — Multi-Tenant Security Cheat Sheet · https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html |
| [16] | Next.js — Authentication (App Router, Proxy/DAL) · https://nextjs.org/docs/app/building-your-application/authentication |
| [17] | Next.js v14 — Authentication (DAL) · https://nextjs.org/docs/14/app/building-your-application/authentication |
| [18] | Next.js Blog — Security in Server Components & Actions (Zero-Trust) · https://nextjs.org/blog/security-nextjs-server-components-actions |
| [19] | Prisma — Transactions & Optimistic Concurrency Control · https://www.prisma.io/docs/orm/prisma-client/queries/transactions |
| [20] | PostgreSQL — Transaction Isolation (READ COMMITTED) · https://www.postgresql.org/docs/current/transaction-iso.html |
| [21] | MITRE CWE-367 — Time-of-check Time-of-use (TOCTOU) Race Condition · https://cwe.mitre.org/data/definitions/367.html |
| [22] | Martin Fowler — Optimistic Offline Lock (P of EAA) · https://martinfowler.com/eaaCatalog/optimisticOfflineLock.html |
| [23] | Auth0 — What is Role-Based Access Control (RBAC) · https://auth0.com/intro-to-iam/what-is-role-based-access-control-rbac |
| [24] | Permit.io — RBAC vs ABAC · https://www.permit.io/blog/rbac-vs-abac |
| [25] | Oso — RBAC vs ABAC vs PBAC · https://www.osohq.com/learn/rbac-vs-abac-vs-pbac |
| [26] | OWASP — Authorization Cheat Sheet · https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html |

> Confianza: §"Nota de método". 3 claims ✅ verificados (3-votos), ~17 ⚠️ fuente-única citada, RQ6/8/9/10 cerradas en re-run acotado (verificación 2-votos, fuentes [12]+).
