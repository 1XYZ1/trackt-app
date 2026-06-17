# Trackt API — Backend NestJS

API REST del sistema Trackt. Este backend administra la lógica de negocio del taller de mantenimiento: autenticación, tenant, equipos, órdenes de trabajo, tickets, evidencias, inventario, reservas, movimientos y notificaciones.

---

## Tabla de contenidos

- [Stack](#stack)
- [Responsabilidades del backend](#responsabilidades-del-backend)
- [Estructura](#estructura)
- [Requisitos](#requisitos)
- [Variables de entorno](#variables-de-entorno)
- [Instalación](#instalación)
- [Base de datos](#base-de-datos)
- [Seed demo](#seed-demo)
- [Scripts disponibles](#scripts-disponibles)
- [Autenticación y roles](#autenticación-y-roles)
- [Módulos](#módulos)
- [Endpoints principales](#endpoints-principales)
- [Reglas de negocio](#reglas-de-negocio)
- [Testing](#testing)
- [Despliegue](#despliegue)
- [Troubleshooting](#troubleshooting)

---

## Stack

- NestJS 11
- TypeScript
- Prisma ORM
- PostgreSQL / Supabase
- Supabase Auth
- Supabase Storage
- class-validator
- class-transformer
- Jest

---

## Responsabilidades del backend

La API se encarga de:

- validar usuarios mediante token Bearer de Supabase;
- resolver el tenant del usuario autenticado;
- controlar acceso por roles;
- exponer endpoints REST para el frontend;
- aplicar reglas de negocio del flujo OT → Ticket;
- registrar eventos de estado;
- generar códigos únicos para OT y tickets;
- administrar repuestos, stock, reservas y movimientos;
- generar URLs firmadas para evidencias;
- crear y consultar notificaciones.

---

## Estructura

```txt
producto/trackt-api/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── auth/
│   ├── common/
│   ├── equipos/
│   ├── evidencias/
│   ├── inventario/
│   ├── notificaciones/
│   ├── ordenes/
│   ├── prisma/
│   ├── tickets/
│   ├── usuarios/
│   ├── app.module.ts
│   └── main.ts
├── supabase/
│   └── migrations/
├── .env.example
├── package.json
└── README.md
```

---

## Requisitos

- Node.js 20 o superior.
- npm.
- Proyecto Supabase activo.
- Supabase CLI, opcional pero recomendado para aplicar migraciones.

---

## Variables de entorno

Crear un archivo `.env` a partir de `.env.example`:

```bash
cp .env.example .env
```

Contenido esperado:

```env
DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require"

SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""

NODE_ENV="development"
PORT="3001"
```

Notas:

- `DATABASE_URL` usa el pooler de Supabase para runtime.
- `DIRECT_URL` usa conexión directa para Prisma/migraciones.
- `SUPABASE_SERVICE_ROLE_KEY` es sensible. No debe exponerse en frontend.
- Para correr junto al frontend local, se recomienda `PORT=3001`.

---

## Instalación

```bash
cd producto/trackt-api
npm install
npx prisma generate
npm run start:dev
```

La API quedará disponible en:

```txt
http://localhost:3001
```

Si no se define `PORT`, Nest usará `3000` por defecto.

---

## Base de datos

El modelo Prisma está en:

```txt
prisma/schema.prisma
```

Las migraciones SQL para Supabase están en:

```txt
supabase/migrations/
```

Comandos útiles:

```bash
npx prisma validate
npx prisma generate
```

Para aplicar migraciones con Supabase CLI:

```bash
supabase db push
```

También pueden aplicarse desde el SQL Editor de Supabase si el flujo del equipo lo requiere.

---

## Seed demo

El proyecto incluye un seed para crear datos de prueba.

```bash
npm run db:seed
```

Crea:

- tenant demo;
- usuarios demo;
- equipos;
- órdenes de trabajo;
- tickets en distintos estados.

Credenciales demo:

| Rol | Email | Password |
|---|---|---|
| Admin | `admin@trackt.demo` | `Trackt!2026` |
| Mecánicos | `mecanico1@trackt.demo` a `mecanico4@trackt.demo` | `Trackt!2026` |

---

## Scripts disponibles

| Script | Uso |
|---|---|
| `npm run start` | Ejecuta Nest en modo normal. |
| `npm run start:dev` | Ejecuta Nest en modo desarrollo con watch. |
| `npm run start:prod` | Ejecuta el build compilado. |
| `npm run build` | Compila el proyecto. |
| `npm run lint` | Ejecuta ESLint con fix. |
| `npm run format` | Formatea archivos TypeScript. |
| `npm run test` | Ejecuta tests unitarios. |
| `npm run test:cov` | Ejecuta tests con cobertura. |
| `npm run db:seed` | Carga datos demo usando Prisma seed. |

---

## Autenticación y roles

La API usa Supabase Auth.

Flujo:

1. El frontend inicia sesión con Supabase.
2. El frontend envía el `access_token` como Bearer Token.
3. `AuthGuard` valida el token con Supabase.
4. `ProfileService` obtiene el perfil del usuario.
5. `TenantService` resuelve el `tenantId`.
6. `RolesGuard` valida permisos del endpoint.

Header requerido:

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
```

Roles soportados:

| Rol | Descripción |
|---|---|
| `admin` | Administración general y cierre operativo. |
| `jefe_taller` | Supervisión de taller, tickets, carga y reservas. |
| `mechanic` | Ejecución de tickets asignados. |

---

## Módulos

| Módulo | Carpeta | Descripción |
|---|---|---|
| Auth | `src/auth` | Guards, roles y perfil autenticado. |
| Common | `src/common` | DTOs compartidos, tenant y utilidades. |
| Prisma | `src/prisma` | Cliente Prisma inyectable. |
| Equipos | `src/equipos` | CRUD de equipos. |
| Órdenes | `src/ordenes` | CRUD y reglas de OT. |
| Tickets | `src/tickets` | Creación, asignación, ejecución, validación y cierre. |
| Evidencias | `src/evidencias` | URLs firmadas y registro de evidencias. |
| Inventario | `src/inventario` | Repuestos, stock, reservas y movimientos. |
| Notificaciones | `src/notificaciones` | Notificaciones internas. |
| Usuarios | `src/usuarios` | Consulta de usuarios del tenant. |

---

## Endpoints principales

### Health y usuario

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Health check básico. |
| GET | `/hola` | Respuesta simple de prueba. |
| GET | `/messages` | Consulta tabla demo `messages`. |
| GET | `/me` | Perfil del usuario autenticado. |

### Equipos

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/equipos` | admin, jefe_taller, mechanic | Lista equipos. |
| GET | `/equipos/:id` | admin, jefe_taller, mechanic | Detalle de equipo. |
| POST | `/equipos` | admin | Crea equipo. |
| PATCH | `/equipos/:id` | admin | Actualiza equipo. |
| PATCH | `/equipos/:id/desactivar` | admin | Desactiva equipo. |

Payload de creación:

```json
{
  "codigo": "EXC-001",
  "nombre": "Excavadora 001",
  "marca": "CAT",
  "modelo": "320",
  "ubicacion": "Taller norte"
}
```

### Órdenes de trabajo

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| POST | `/ordenes` | admin, mechanic | Crea OT en estado `PENDIENTE`. |
| GET | `/ordenes` | admin, jefe_taller, mechanic | Lista OT con filtros. |
| GET | `/ordenes/:id` | admin, jefe_taller, mechanic | Detalle de OT. |
| PATCH | `/ordenes/:id` | admin, mechanic | Actualiza descripción/prioridad si está pendiente. |
| POST | `/ordenes/:id/cancelar` | admin | Cancela una OT. |
| POST | `/ordenes/:otId/tickets` | admin, jefe_taller, mechanic | Crea ticket desde una OT. |

Payload de creación:

```json
{
  "equipoId": "<equipo_id>",
  "descripcion": "Equipo presenta fuga hidráulica",
  "prioridad": "ALTA"
}
```

Filtros:

```txt
GET /ordenes?estado=PENDIENTE&equipoId=<id>&page=1&limit=10
```

### Tickets

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/tickets` | admin, jefe_taller, mechanic | Lista tickets. |
| GET | `/tickets/carga-mecanicos` | admin, jefe_taller | Resumen de carga por mecánico. |
| GET | `/tickets/:id` | admin, jefe_taller, mechanic | Detalle con timeline. |
| POST | `/tickets/:id/asignar` | admin, jefe_taller | Asigna mecánico. |
| POST | `/tickets/:id/reasignar` | admin, jefe_taller | Reasigna mecánico. |
| POST | `/tickets/:id/iniciar` | mechanic | Inicia ejecución. |
| POST | `/tickets/:id/finalizar` | mechanic | Finaliza ejecución. |
| POST | `/tickets/:id/validar` | admin | Aprueba o rechaza ejecución. |
| POST | `/tickets/:id/cerrar` | admin | Cierra ticket. |

Crear ticket desde OT:

```json
{
  "titulo": "Revisar sistema hidráulico",
  "descripcion": "Inspeccionar fuga y reemplazar sello si corresponde",
  "prioridad": "ALTA"
}
```

Asignar:

```json
{
  "mecanicoId": "<usuario_id>"
}
```

Validar:

```json
{
  "aprobado": true,
  "observacion": "Trabajo revisado correctamente"
}
```

### Evidencias

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| POST | `/tickets/:id/evidencia/signed-url` | admin, jefe_taller, mechanic | Solicita URL firmada para subir archivo. |
| POST | `/tickets/:id/evidencia` | admin, jefe_taller, mechanic | Confirma evidencia subida. |
| GET | `/tickets/:id/evidencias` | admin, jefe_taller, mechanic | Lista evidencias del ticket. |

Formatos permitidos:

```txt
image/jpeg, image/png, image/webp
```

Tamaño máximo:

```txt
5 MB
```

### Inventario

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| POST | `/inventario/repuestos` | admin | Crea repuesto. |
| GET | `/inventario/repuestos` | admin, jefe_taller, mechanic | Lista repuestos. |
| GET | `/inventario/repuestos/:id` | admin, jefe_taller, mechanic | Detalle de repuesto. |
| PATCH | `/inventario/repuestos/:id` | admin | Actualiza repuesto. |
| PATCH | `/inventario/repuestos/:id/desactivar` | admin | Desactiva repuesto. |
| POST | `/inventario/repuestos/:id/entrada` | admin | Registra entrada de stock. |
| POST | `/inventario/repuestos/:id/ajuste` | admin | Ajusta stock con observación. |
| GET | `/inventario/movimientos` | admin, jefe_taller | Lista movimientos. |
| POST | `/tickets/:ticketId/reservas-repuestos` | admin, jefe_taller, mechanic | Crea reserva para ticket. |
| GET | `/tickets/:ticketId/reservas-repuestos` | admin, jefe_taller, mechanic | Lista reservas del ticket. |
| POST | `/reservas-repuestos/:id/liberar` | admin, jefe_taller, mechanic | Libera reserva. |
| POST | `/reservas-repuestos/:id/consumir` | admin, jefe_taller, mechanic | Consume reserva. |

Crear repuesto:

```json
{
  "codigo": "REP-001",
  "nombre": "Filtro hidráulico",
  "descripcion": "Filtro para circuito hidráulico",
  "categoria": "Hidráulica",
  "unidad": "unidad",
  "stockMinimo": 2,
  "stockInicial": 10
}
```

Crear reserva:

```json
{
  "observacion": "Reserva para reparación preventiva",
  "items": [
    {
      "repuestoId": "<repuesto_id>",
      "cantidad": 2
    }
  ]
}
```

### Notificaciones

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/notificaciones` | admin, jefe_taller, mechanic | Lista notificaciones. |
| GET | `/notificaciones/count-no-leidas` | admin, jefe_taller, mechanic | Cuenta no leídas. |
| PATCH | `/notificaciones/:id/leer` | admin, jefe_taller, mechanic | Marca una como leída. |
| PATCH | `/notificaciones/leer-todas` | admin, jefe_taller, mechanic | Marca todas como leídas. |

### Usuarios

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/usuarios` | admin | Lista usuarios del tenant. |

Filtros:

```txt
GET /usuarios?rol=mecanico&search=juan&page=1&limit=10
```

---

## Reglas de negocio

### Códigos únicos

Órdenes:

```txt
OT-{YYYY}-{NNNN}
```

Tickets:

```txt
TKT-{YYYY}-{NNNN}
```

La generación considera tenant y año. En órdenes se usa `pg_advisory_xact_lock` para evitar colisiones concurrentes.

### Estados de OT

```txt
PENDIENTE → EN_PROCESO → CERRADA
        ↘ CANCELADA
```

### Estados de ticket

```txt
PENDIENTE → ASIGNADO → EN_EJECUCION → EJECUTADO → CERRADO
        ↘ CANCELADO
```

### Multi-tenant

Todas las entidades de negocio incluyen `tenantId`. El backend siempre filtra operaciones usando el tenant del usuario autenticado.

### Auditoría

Los cambios de estado del ticket quedan registrados en `EventoEstadoTicket`, permitiendo construir una línea de tiempo del trabajo.

---

## Testing

Ejecutar tests:

```bash
npm run test
```

Cobertura:

```bash
npm run test:cov
```

Validación completa recomendada antes de PR:

```bash
npx prisma validate
npx prisma generate
npm run build
npm run test
```

---

## Despliegue

El backend puede desplegarse en Railway.

Checklist:

- configurar variables de entorno en Railway;
- confirmar que `DATABASE_URL` y `DIRECT_URL` apuntan a Supabase;
- ejecutar `npm run build`;
- usar `npm run start:prod` como comando de producción;
- configurar CORS según el dominio del frontend si se endurece la seguridad.

Comando de producción:

```bash
npm run start:prod
```

---

## Troubleshooting

### Error: `Missing token`

El endpoint requiere autenticación y no se envió header Bearer.

Solución:

```http
Authorization: Bearer <access_token>
```

### Error: `Profile not found`

El usuario existe en Supabase Auth, pero no tiene perfil asociado en la tabla de perfiles.

Solución:

- revisar migraciones de profiles;
- revisar seed;
- crear perfil asociado al usuario.

### Error de conexión Prisma/Supabase

Revisar:

- `DATABASE_URL`;
- `DIRECT_URL`;
- password de base de datos;
- `sslmode=require`;
- región y project ref.

### Frontend no conecta con backend

Confirmar que el backend esté arriba y que el frontend tenga:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

---

## Notas para desarrollo

- Mantener DTOs actualizados con las necesidades del frontend.
- No exponer `SUPABASE_SERVICE_ROLE_KEY` fuera del backend.
- Mantener sincronizados `schema.prisma` y migraciones SQL.
- Agregar tests por cada regla de negocio nueva.
- Documentar nuevos endpoints en este README.
