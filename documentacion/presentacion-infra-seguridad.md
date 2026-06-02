# Trackt — Infraestructura y Seguridad
### Guión de presentación (~10 min)

> **Cómo usar este documento:** cada sección es una slide. El bloque **Slide** es lo que va proyectado (bullets). El bloque **Guión** es lo que dices en voz alta, con el tiempo objetivo entre paréntesis. Tiempo total ≈ 10:00.
>
> Arquitectura descrita según el **estado real del código** del repo (no según `setup-summary.md`, que quedó desfasado).

---

## Slide 1 — Portada (0:30)

**Slide**
- **Trackt** — Infraestructura & Seguridad
- Sistema de gestión de taller: órdenes de trabajo, tickets, inventario y evidencias
- Equipo: Rosio Ametller · Jaime Osorio · Ramón Hernández

**Guión (0:30)**
> "Buenas. En los próximos 10 minutos voy a mostrar cómo está montado Trackt por dentro: primero la infraestructura —qué tecnologías usamos y dónde corre cada cosa— y luego la seguridad, que es donde pusimos más cuidado: autenticación, roles, aislamiento entre clientes y manejo de archivos. Trackt es un sistema para gestión de taller: equipos, órdenes de trabajo, tickets para los mecánicos, inventario de repuestos y evidencias fotográficas."

---

## Slide 2 — Vista general de la arquitectura (1:15)

**Slide**
```
  Navegador
     │  HTTPS
     ▼
  Frontend (Next.js SSR)    Backend (API REST)            Datos / Servicios
  Next.js 16 (App Router)→  NestJS 11 + Prisma      →     Supabase
  React 19                  TypeScript                    · PostgreSQL
  TanStack Query            JWT Bearer auth               · Auth (JWT)
  shadcn/ui + Tailwind 4    Deploy: Railway               · Storage (evidencias)
  Deploy: Vercel
```
- 3 capas desacopladas, cada una desplegada por separado
- Comunicación: HTTPS + tokens JWT en cada request

**Guión (1:15)**
> "La arquitectura son tres capas independientes. Un frontend en Next.js 16, que dibuja la interfaz y protege las rutas, desplegado en Vercel. Una API REST hecha en NestJS con TypeScript, que tiene toda la lógica de negocio y corre en Railway. Y abajo, Supabase, que nos da tres servicios en uno: la base de datos PostgreSQL, el sistema de autenticación, y el almacenamiento de archivos para las evidencias.
>
> La gracia de tenerlo desacoplado es que cada capa se despliega, escala y falla por separado. El frontend nunca habla directo con la base de datos: todo pasa por la API, y todo viaja por HTTPS con un token de por medio. Eso ya es la primera decisión de seguridad: un solo punto de entrada controlado."

---

## Slide 3 — Frontend (1:00)

**Slide**
- **Next.js 16 (App Router) + React 19** — rendering en servidor, desplegado en **Vercel**
- **Protección de rutas en el servidor**: middleware valida la sesión (`supabase.auth.getUser()`) en cada request y redirige a `/login` si no hay sesión
- **Sesión en cookies** vía `@supabase/ssr` (no en localStorage → menos exposición a XSS)
- **TanStack Query** para estado de servidor/caché · **shadcn + Tailwind 4** · validación con **zod**
- `authFetch` adjunta el token de Supabase como `Bearer` a la API (auto-refresh + retry en 401)
- Falla el build en producción si faltan las env vars de Supabase

**Guión (1:00)**
> "El frontend es Next.js 16 con App Router, desplegado en Vercel. A diferencia de una SPA tradicional, acá hay protección de rutas del lado del servidor: un middleware valida la sesión contra Supabase en cada request, y si no estás autenticado te manda a login antes de que se renderice nada. La sesión vive en cookies manejadas por la librería SSR de Supabase, no en localStorage, lo que reduce la exposición a ataques de XSS.
>
> Para los datos usamos TanStack Query, la UI está sobre shadcn y Tailwind, y los formularios se validan con zod. Cuando el front llama a la API, un wrapper le adjunta el token de Supabase como Bearer y, si recibe un 401, refresca el token y reintenta una vez. Detalle de robustez: si faltan las variables de entorno de Supabase, el build de producción falla a propósito, para no desplegar algo a medias."

---

## Slide 4 — Backend / API (1:15)

**Slide**
- **NestJS 11 + TypeScript** — arquitectura modular (un módulo por dominio)
- Módulos: `auth`, `tenant`, `equipos`, `usuarios`, `ordenes`, `tickets`, `evidencias`, `inventario`, `notificaciones`
- **Prisma 6** como ORM → PostgreSQL
- **Validación global**: `ValidationPipe` con `whitelist` + `transform`
  - descarta campos no declarados en el DTO
  - convierte y valida tipos antes de tocar la lógica
- Deploy en **Railway** (Node)

**Guión (1:15)**
> "El backend es NestJS, que nos obliga a una estructura modular: cada dominio del negocio es un módulo separado —tickets, órdenes, inventario, evidencias, etc.—. Eso mantiene el código ordenado y hace fácil aplicar reglas de seguridad por módulo.
>
> Para la base de datos usamos Prisma como ORM, que genera queries con tipos y nos protege de inyección SQL en las consultas normales.
>
> Una pieza clave de seguridad que activamos globalmente es el ValidationPipe. Con `whitelist`, cualquier campo que el cliente mande y que no esté declarado en nuestro DTO se descarta automáticamente —no llega a la lógica—. Y con `transform`, los datos se convierten y validan al tipo correcto antes de procesarse. O sea, ningún dato entra a la API sin pasar por un filtro. La API se despliega en Railway."

---

## Slide 5 — Base de datos y modelo de datos (1:00)

**Slide**
- **Supabase PostgreSQL**, región East US
- Conexión vía **pooler** (modo transacción, puerto 6543) en runtime; conexión directa (5432) sólo para migraciones
- `sslmode=require` → tráfico a la DB siempre cifrado
- Modelo: `Tenant`, `Equipo`, `OrdenTrabajo`, `Ticket`, `Evidencia`, `Repuesto`, `InventarioStock`, `ReservaRepuesto`, `MovimientoInventario`, `Notificacion`…
- **`tenant_id` en todas las tablas de negocio** → multi-tenant desde el diseño

**Guión (1:00)**
> "La base es PostgreSQL administrada por Supabase. En producción nos conectamos a través de un pooler de conexiones en modo transacción, que aguanta muchas conexiones concurrentes sin saturar la base; la conexión directa sólo se usa para correr migraciones. Y todo el tráfico a la base va cifrado con SSL obligatorio.
>
> El modelo cubre todo el flujo del taller: equipos, órdenes de trabajo, tickets, evidencias, e inventario con stock, reservas y movimientos. El detalle de diseño más importante para seguridad es que **todas** las tablas de negocio llevan un `tenant_id`. Eso significa que el sistema está pensado desde el día uno para que convivan varios clientes —varios talleres— en la misma base, sin verse entre ellos. Eso me lleva directo a la parte de seguridad."

---

## Slide 6 — Seguridad: Autenticación (1:15)

**Slide**
- Auth delegada a **Supabase Auth** (no manejamos passwords nosotros)
- Cada request a la API trae `Authorization: Bearer <JWT>`
- **`AuthGuard`** en la API:
  1. extrae el token del header
  2. lo valida contra Supabase (`auth.getUser`)
  3. carga el **perfil** (rol + tenant) desde la tabla `profiles`
  4. inyecta el usuario en el request
- Sin token válido o sin perfil → **401**
- Caché de perfiles en memoria (TTL 5 min) para no golpear la DB en cada request

**Guión (1:15)**
> "Empecemos por autenticación: saber quién eres. No inventamos nuestro propio sistema de contraseñas —eso es una fuente típica de vulnerabilidades—. Lo delegamos a Supabase Auth. El usuario se loguea, Supabase le entrega un token JWT firmado, y ese token viaja en cada llamada a la API en la cabecera Authorization.
>
> Del lado de la API tenemos un AuthGuard, que es un portero que se ejecuta antes de cualquier endpoint protegido. Saca el token, lo valida contra Supabase para confirmar que es legítimo y no expiró, y con el ID del usuario va a buscar su perfil —su rol y a qué taller pertenece—. Si algo de eso falla, devuelve 401 y no se ejecuta nada más.
>
> Para no consultar la base en cada request, los perfiles se cachean en memoria 5 minutos. Es un balance entre rendimiento y que un cambio de permisos se refleje rápido."

---

## Slide 7 — Seguridad: Autorización por roles (1:15)

**Slide**
- 3 roles: **`admin`**, **`jefe_taller`**, **`mechanic`**
- **`RolesGuard`** + decorador **`@Roles(...)`** por endpoint
- Modelo de **mínimo privilegio**, ejemplos reales en tickets:

| Acción | Roles permitidos |
|---|---|
| Listar / ver tickets | admin, jefe_taller, mechanic |
| Asignar / reasignar | admin, jefe_taller |
| Iniciar / finalizar | **mechanic** (el asignado) |
| Validar / cerrar | **admin** |

**Guión (1:15)**
> "Autenticado no es lo mismo que autorizado. Saber quién eres no significa que puedas hacer todo. Tenemos tres roles: admin, jefe de taller y mecánico.
>
> Sobre cada endpoint ponemos un decorador `@Roles` que declara quién puede entrar, y un RolesGuard que lo hace cumplir. Es mínimo privilegio: cada quien sólo puede hacer lo que su rol necesita. Por ejemplo, en el ciclo de un ticket: cualquiera con sesión puede ver tickets, pero sólo un jefe de taller o admin puede asignarlos; sólo el mecánico puede iniciar y finalizar su trabajo; y sólo un admin puede validar y cerrar. Un mecánico no puede auto-asignarse trabajo ni cerrarse sus propios tickets. Las reglas están en el código, no dependen de que el frontend 'esconda un botón'."

---

## Slide 8 — Seguridad: Aislamiento multi-tenant (0:50)

**Slide**
- Cada usuario pertenece a un **`tenant`** (taller)
- **`TenantService`** resuelve el `tenant_id` desde el token, no desde lo que mande el cliente
- **Toda** consulta filtra por `tenant_id` → un taller nunca ve datos de otro
- El cliente no puede "pedir" otro tenant: se toma del perfil autenticado

**Guión (0:50)**
> "El tercer pilar es el aislamiento entre clientes. Como dije, todo lleva tenant_id. La clave está en de dónde sacamos ese tenant: el TenantService lo lee del token autenticado, **nunca** de un parámetro que mande el cliente. Eso cierra un ataque clásico —que alguien cambie un ID en la URL para ver datos de otro taller—. Aunque lo intente, la API siempre filtra por el tenant de su propia sesión. Un taller jamás ve órdenes, tickets ni inventario de otro."

---

## Slide 9 — Seguridad: Evidencias / archivos (1:15)

**Slide**
- Flujo de subida con **signed URLs** (el archivo nunca pasa por nuestra API)
  1. cliente pide URL → API valida rol, tamaño y tipo, y genera URL firmada (TTL **60s**)
  2. cliente sube directo a Supabase Storage
  3. cliente confirma → API verifica que el archivo existe y registra la evidencia
- Controles:
  - **MIME whitelist**: sólo `jpg`, `png`, `webp`
  - **Tamaño máx**: 5 MB
  - **Ruta scopeada**: `tenant_id/ticket_id/uuid.ext`
  - **Descarga** con URL firmada temporal (TTL **5 min**)
  - **Service-role key** sólo en el servidor, nunca en el cliente

**Guión (1:15)**
> "Las evidencias son fotos que suben los mecánicos, y los archivos siempre son un punto delicado. Acá usamos un patrón de URLs firmadas. El archivo nunca pasa por nuestra API: el cliente pide permiso, la API valida que tenga el rol, que el tipo sea una imagen permitida y que no exceda 5 megas, y le entrega una URL firmada que dura sólo 60 segundos. Con eso sube directo a Supabase. Después confirma, y la API verifica que el archivo realmente exista antes de registrarlo.
>
> Los controles son varios: sólo aceptamos jpg, png y webp; máximo 5 megas; y cada archivo se guarda en una ruta que incluye el tenant y el ticket, así no se pisan ni se filtran. Para descargar, igual: URLs firmadas que expiran en 5 minutos, no enlaces públicos permanentes. Y la llave de administrador de Supabase —la que puede saltarse todas las reglas— vive sólo en el servidor; jamás llega al navegador."

---

## Slide 10 — Seguridad: Secretos, red y RLS (0:45)

**Slide**
- **Secretos**: `.env` en `.gitignore`; sólo se versiona `.env.example` sin valores
- Variables sensibles (service-role key, DB password) sólo en el entorno del servidor (Railway / Supabase)
- **RLS habilitado** en Supabase como segunda capa a nivel de base
- **HTTPS** extremo a extremo; SSL obligatorio hacia la DB
- Defensa en profundidad: validación de input → auth → roles → tenant → RLS

**Guión (0:45)**
> "Para cerrar la parte técnica de seguridad: los secretos nunca van al repositorio. El archivo de variables está ignorado por git; sólo subimos una plantilla vacía. Las llaves de verdad viven en el entorno de Railway y Supabase. Encima, Supabase tiene Row Level Security activado, que es una segunda reja a nivel de base de datos. Y todo el tráfico es HTTPS.
>
> La idea de fondo es defensa en profundidad: para que un dato salga indebidamente tendría que fallar la validación, **y** el guard de auth, **y** el de roles, **y** el filtro de tenant, **y** las reglas de la base. Son varias capas, no una sola."

---

## Slide 11 — Proceso / Gitflow (0:30)

**Slide**
- `main` protegida: nada se mergea sin **Pull Request**
- Una rama = un ticket de Linear = un PR; **squash merge**
- Conventional Commits + Conventional Branches con ID de Linear
- Trazabilidad automática: la rama mueve el ticket de estado solo

**Guión (0:30)**
> "Y la seguridad también es proceso. La rama main está protegida: nadie sube código directo, todo entra por Pull Request con revisión. Cada cambio se ata a un ticket de Linear, así hay trazabilidad de quién cambió qué y por qué. Eso reduce el riesgo de que entre código malo o sin revisar a producción."

---

## Slide 12 — Cierre (0:30)

**Slide**
- **Infra**: 3 capas desacopladas (Next.js · NestJS · Supabase), cada una desplegada aparte
- **Seguridad en capas**: validación → JWT → roles → multi-tenant → signed URLs → RLS
- Sin secretos en el repo · HTTPS · mínimo privilegio
- ¿Preguntas?

**Guión (0:30)**
> "En resumen: tres capas independientes, fáciles de mantener y escalar. Y una seguridad pensada en capas: validamos todo lo que entra, verificamos quién eres con JWT, qué puedes hacer con roles, te aislamos por tenant, manejamos archivos con URLs firmadas temporales, y dejamos RLS como red final. Nada de secretos en el código y todo cifrado. Quedo atento a preguntas."

---

### Apéndice — Datos para responder preguntas

- **Stack exacto**: Next.js 16 (App Router), React 19, `@supabase/ssr`, TanStack Query, Tailwind 4, shadcn, zod (front) · NestJS 11, Prisma 6, class-validator (API) · Supabase (Postgres + Auth + Storage).
- **Frontend real**: `producto/tract-front` (paquete `trackt-front`). Nota: la carpeta `shadcn-admin/` del workspace es una plantilla externa (`satnaing/shadcn-admin`), **no** es el frontend de Trackt.
- **Roles**: `admin`, `jefe_taller`, `mechanic` (definidos en `src/auth/types.ts`).
- **TTLs**: caché de perfil 5 min · signed upload 60 s · signed download 5 min.
- **Límites de evidencia**: MIME `image/jpeg|png|webp`, máx 5 MB (`request-upload.dto.ts`).
- **Conexión DB**: pooler 6543 (runtime) / directo 5432 (migraciones), `sslmode=require`.
- **Nota de honestidad**: `setup-summary.md` acierta en el stack de infra (Next.js/Vercel + NestJS/Railway + Supabase), pero su sección de tablas y endpoints (sólo tabla `messages`, dos rutas) quedó desfasada respecto al sistema actual; conviene actualizar esa parte.
