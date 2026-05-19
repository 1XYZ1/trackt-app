# Trackt — Sistema de gestión de mantenimiento industrial

Trackt es una plataforma web para administrar el flujo operativo de un taller de mantenimiento industrial. El sistema permite registrar equipos, crear órdenes de trabajo, convertirlas en tickets ejecutables, asignar mecánicos, controlar estados, adjuntar evidencias, gestionar repuestos y mantener trazabilidad del trabajo realizado.

El objetivo principal es ordenar el ciclo completo de mantenimiento: desde la solicitud inicial hasta el cierre validado del trabajo.

---

## Tabla de contenidos

- [Descripción general](#descripción-general)
- [Arquitectura](#arquitectura)
- [Stack tecnológico](#stack-tecnológico)
- [Módulos principales](#módulos-principales)
- [Roles del sistema](#roles-del-sistema)
- [Flujo funcional](#flujo-funcional)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Instalación local](#instalación-local)
- [Variables de entorno](#variables-de-entorno)
- [Datos demo](#datos-demo)
- [Validación del proyecto](#validación-del-proyecto)
- [Despliegue](#despliegue)
- [Flujo de trabajo con Git](#flujo-de-trabajo-con-git)

---

## Descripción general

Trackt organiza el mantenimiento a partir de tres conceptos centrales:

1. **Equipo:** activo o maquinaria que requiere control y mantención.
2. **Orden de trabajo:** solicitud inicial asociada a un equipo.
3. **Ticket:** unidad operativa de trabajo que se asigna, ejecuta, valida y cierra.

Además, el sistema incorpora:

- autenticación con Supabase Auth;
- control de roles;
- separación por tenant;
- evidencias fotográficas por ticket;
- inventario de repuestos;
- reservas y consumo de repuestos;
- notificaciones operativas;
- dashboard y vistas de seguimiento.

---

## Arquitectura

```txt
trackt-front  →  trackt-api  →  Supabase PostgreSQL / Auth / Storage
Next.js          NestJS         Base de datos, usuarios y archivos
Vercel           Railway        supabase.co
```

La aplicación se divide en dos productos principales:

| Capa | Carpeta | Descripción |
|---|---|---|
| Frontend | `producto/tract-front` | Aplicación web desarrollada con Next.js. |
| Backend | `producto/trackt-api` | API REST desarrollada con NestJS. |
| Base de datos | `producto/trackt-api/supabase/migrations` | Migraciones SQL para Supabase/PostgreSQL. |
| ORM | `producto/trackt-api/prisma/schema.prisma` | Modelado de entidades y cliente Prisma. |

---

## Stack tecnológico

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui + Base UI
- React Query
- Supabase SSR/Auth
- Lucide Icons
- Sonner

### Backend

- NestJS 11
- TypeScript
- Prisma ORM
- Supabase JS
- PostgreSQL/Supabase
- class-validator / class-transformer
- Jest

### Infraestructura

- Supabase para base de datos, autenticación y storage.
- Vercel para frontend.
- Railway para backend.

---

## Módulos principales

| Módulo | Función |
|---|---|
| Autenticación | Login, sesión Supabase y validación de token Bearer. |
| Usuarios | Listado de usuarios por tenant y rol. |
| Equipos | Registro, edición, consulta y desactivación de equipos. |
| Órdenes de trabajo | Creación y seguimiento de solicitudes de mantenimiento. |
| Tickets | Asignación, ejecución, validación, cierre y timeline de estados. |
| Evidencias | Carga y consulta de evidencias asociadas a tickets. |
| Inventario | Gestión de repuestos, stock, reservas, consumo y movimientos. |
| Notificaciones | Alertas internas de eventos relevantes del flujo. |
| Dashboard | Vista operativa para seguimiento general del taller. |

---

## Roles del sistema

| Rol interno | Descripción general |
|---|---|
| `admin` | Administra equipos, órdenes, tickets, usuarios, inventario y cierre operativo. |
| `jefe_taller` | Supervisa carga de mecánicos, tickets, órdenes y reservas. |
| `mechanic` | Ejecuta tickets asignados, registra avances y evidencia. |

El backend valida permisos mediante `AuthGuard` y `RolesGuard`. El tenant se obtiene desde el perfil del usuario autenticado.

---

## Flujo funcional

### 1. Orden de trabajo

Una OT nace como una solicitud asociada a un equipo.

```txt
PENDIENTE → EN_PROCESO → CERRADA
        ↘ CANCELADA
```

Reglas principales:

- La OT se crea en estado `PENDIENTE`.
- Al crear el primer ticket asociado, pasa a `EN_PROCESO`.
- Cuando todos sus tickets están cerrados, pasa a `CERRADA`.
- Una OT puede ser cancelada por un administrador.

### 2. Ticket

El ticket representa la unidad real de trabajo del taller.

```txt
PENDIENTE → ASIGNADO → EN_EJECUCION → EJECUTADO → CERRADO
        ↘ CANCELADO
```

Reglas principales:

- Se crea desde una orden de trabajo.
- Puede asignarse o reasignarse a un mecánico.
- El mecánico inicia y finaliza la ejecución.
- Un administrador valida el trabajo.
- Finalmente el ticket se cierra.

### 3. Inventario

El inventario permite:

- crear repuestos;
- consultar stock;
- registrar entradas;
- realizar ajustes;
- reservar repuestos para tickets;
- liberar o consumir reservas;
- auditar movimientos.

---

## Estructura del repositorio

```txt
trackt-app-main/
├── documentacion/
│   ├── gitflow.md
│   ├── setup-summary.md
│   └── trackt-presentacion.pdf
├── gestion/
│   ├── integrantes.txt
│   └── trackt.pdf
└── producto/
    ├── trackt-api/
    │   ├── prisma/
    │   ├── src/
    │   ├── supabase/migrations/
    │   ├── package.json
    │   └── README.md
    └── tract-front/
        ├── src/
        ├── public/
        ├── package.json
        └── README.md
```

---

## Instalación local

### Requisitos

- Node.js 20 o superior.
- npm.
- Proyecto Supabase configurado.
- Supabase CLI, si se desea aplicar migraciones desde terminal.

### 1. Clonar repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd trackt-app-main
```

### 2. Levantar backend

```bash
cd producto/trackt-api
npm install
cp .env.example .env
npx prisma generate
npm run start:dev
```

Para desarrollo local junto al frontend, se recomienda usar el backend en el puerto `3001` para no chocar con Next.js:

```env
PORT="3001"
```

### 3. Levantar frontend

En otra terminal:

```bash
cd producto/tract-front
npm install
npm run dev
```

Abrir:

```txt
http://localhost:3000
```

---

## Variables de entorno

### Backend: `producto/trackt-api/.env`

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."
NODE_ENV="development"
PORT="3001"
```

### Frontend: `producto/tract-front/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

---

## Datos demo

El backend incluye un seed demo para QA y presentaciones.

```bash
cd producto/trackt-api
npm run db:seed
```

El seed crea:

- 1 tenant demo;
- 1 usuario administrador;
- 4 mecánicos;
- equipos;
- órdenes de trabajo;
- tickets en distintos estados.

Credenciales documentadas para demo:

| Rol | Usuario |
|---|---|
| Admin | `admin@trackt.demo` |
| Mecánicos | `mecanico1@trackt.demo` a `mecanico4@trackt.demo` |

Password demo:

```txt
Trackt!2026
```

---

## Validación del proyecto

### Backend

```bash
cd producto/trackt-api
npm run build
npm run test
```

### Frontend

```bash
cd producto/tract-front
npm run lint
npm run build
```

---

## Despliegue

El proyecto está preparado para desplegarse con esta distribución:

| Servicio | Plataforma sugerida |
|---|---|
| Frontend | Vercel |
| Backend | Railway |
| Base de datos/Auth/Storage | Supabase |

Variables críticas en producción:

- `NEXT_PUBLIC_API_URL` debe apuntar a la URL pública del backend.
- `SUPABASE_SERVICE_ROLE_KEY` solo debe existir en backend o entornos server-side seguros.
- Nunca subir archivos `.env` al repositorio.

---

## Flujo de trabajo con Git

El proyecto usa una guía de Gitflow ubicada en:

```txt
documentacion/gitflow.md
```

Regla principal:

```txt
una rama = un ticket de Linear = un Pull Request
```

Formato sugerido de ramas:

```txt
feat/TRA-12-login-google
fix/TRA-45-token-expira-mal
docs/TRA-9-readme-api
```

Formato sugerido de commits:

```txt
feat(api): agregar endpoint de tickets (TRA-12)
fix(front): corregir redirect del login (TRA-45)
docs(repo): actualizar readme general (TRA-9)
```

---

## Integrantes

Según la documentación del proyecto:

- Rosio Ametller
- Jaime Osorio
- Ramon Hernandez

---

## Estado general

Trackt cuenta con una base funcional que cubre el flujo central de mantenimiento: equipos, órdenes, tickets, estados, evidencias, inventario y notificaciones. Para continuidad del desarrollo se recomienda mantener actualizados los README de backend y frontend cada vez que se agreguen nuevos endpoints, pantallas o reglas de negocio.
