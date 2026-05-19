# Trackt Front — Frontend Next.js

Frontend web de Trackt, plataforma de gestión de mantenimiento industrial. Esta aplicación permite a administradores, jefes de taller y mecánicos operar el flujo completo de órdenes de trabajo, tickets, equipos, evidencias, inventario y notificaciones.

---

## Tabla de contenidos

- [Stack](#stack)
- [Responsabilidades del frontend](#responsabilidades-del-frontend)
- [Estructura](#estructura)
- [Requisitos](#requisitos)
- [Variables de entorno](#variables-de-entorno)
- [Instalación](#instalación)
- [Scripts disponibles](#scripts-disponibles)
- [Rutas principales](#rutas-principales)
- [Autenticación](#autenticación)
- [Consumo de API](#consumo-de-api)
- [Módulos visuales](#módulos-visuales)
- [Validación antes de entregar](#validación-antes-de-entregar)
- [Despliegue](#despliegue)
- [Troubleshooting](#troubleshooting)

---

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Base UI
- React Query
- Supabase SSR/Auth
- next-themes
- Lucide React
- Recharts
- Sonner
- Zod
- React Hook Form

---

## Responsabilidades del frontend

El frontend se encarga de:

- gestionar login, recuperación y reset de contraseña;
- mantener sesión con Supabase;
- enviar el token Bearer al backend;
- mostrar dashboard operativo;
- listar y administrar equipos;
- listar, crear y consultar órdenes de trabajo;
- crear tickets desde órdenes;
- asignar, reasignar, iniciar, finalizar, validar y cerrar tickets;
- mostrar carga de mecánicos;
- gestionar inventario y reservas;
- mostrar notificaciones;
- adaptar la experiencia según el rol del usuario.

---

## Estructura

```txt
producto/tract-front/
├── public/
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   ├── (auth)/
│   │   ├── actions/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── core/
│   │   ├── equipos/
│   │   ├── inventario/
│   │   ├── layout/
│   │   ├── ordenes/
│   │   ├── tickets/
│   │   └── ui/
│   ├── contexts/
│   ├── hooks/
│   └── lib/
│       ├── api/
│       ├── auth/
│       └── supabase/
├── components.json
├── next.config.ts
├── package.json
└── README.md
```

---

## Requisitos

- Node.js 20 o superior.
- npm.
- Backend Trackt API corriendo localmente o desplegado.
- Proyecto Supabase configurado.

---

## Variables de entorno

Crear archivo `.env.local` en `producto/tract-front`:

```env
NEXT_PUBLIC_SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<SUPABASE_ANON_KEY>"
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

Variable server-side opcional usada por utilidades administrativas:

```env
SUPABASE_SERVICE_ROLE_KEY="<SUPABASE_SERVICE_ROLE_KEY>"
```

Importante:

- `NEXT_PUBLIC_*` queda disponible para el navegador.
- `SUPABASE_SERVICE_ROLE_KEY` no debe exponerse públicamente.
- En producción, `NEXT_PUBLIC_API_URL` debe apuntar al backend desplegado.

---

## Instalación

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

## Scripts disponibles

| Script | Uso |
|---|---|
| `npm run dev` | Levanta Next.js en desarrollo. |
| `npm run build` | Genera build de producción. |
| `npm run start` | Ejecuta la app compilada. |
| `npm run lint` | Ejecuta ESLint. |

---

## Rutas principales

### Autenticación

| Ruta | Descripción |
|---|---|
| `/login` | Inicio de sesión. |
| `/forgot-password` | Solicitud de recuperación de contraseña. |
| `/reset-password` | Cambio de contraseña. |

### Aplicación

| Ruta | Descripción |
|---|---|
| `/dashboard` | Centro de control operacional. |
| `/equipos` | Gestión y listado de equipos. |
| `/ordenes` | Listado y creación de órdenes de trabajo. |
| `/ordenes/[id]` | Detalle de una orden de trabajo. |
| `/ordenes-trabajo` | Alias/reexport de órdenes de trabajo. |
| `/tickets` | Listado general de tickets. |
| `/tickets/[id]` | Detalle operativo de ticket. |
| `/mis-tickets` | Tickets asociados al mecánico autenticado. |
| `/mis-tickets/[id]` | Ejecución de ticket asignado. |
| `/taller/carga` | Carga de mecánicos. |
| `/inventario` | Repuestos, stock, reservas y movimientos. |
| `/usuarios` | Gestión/listado de usuarios. |
| `/configuracion/perfil` | Perfil del usuario. |
| `/mantenciones` | Pantalla preparada para mantenciones futuras. |

---

## Autenticación

El frontend usa Supabase para manejar sesión.

Flujo:

1. Usuario inicia sesión en `/login`.
2. Supabase guarda la sesión.
3. Las llamadas al backend pasan por `authFetch`.
4. `authFetch` obtiene el `access_token` actual.
5. El token se envía como Bearer Token.
6. Si el backend responde `401`, se intenta refrescar sesión una vez.

Archivo relevante:

```txt
src/lib/api/http.ts
```

Ejemplo conceptual:

```ts
Authorization: Bearer <access_token>
```

---

## Consumo de API

Los clientes de API están en:

```txt
src/lib/api/
```

| Archivo | Función |
|---|---|
| `http.ts` | Wrapper `authFetch` con token Supabase. |
| `equipos.ts` | CRUD de equipos. |
| `ordenes.ts` | Órdenes de trabajo. |
| `tickets.ts` | Tickets y transiciones de estado. |
| `mis-tickets.ts` | Vista operativa del mecánico. |
| `inventario.ts` | Repuestos, stock, reservas y movimientos. |
| `evidencias.ts` | Evidencias de tickets. |
| `notificaciones.ts` | Notificaciones y contador de no leídas. |
| `usuarios.ts` | Usuarios del tenant. |

La URL base se lee desde:

```env
NEXT_PUBLIC_API_URL
```

---

## Módulos visuales

| Carpeta | Descripción |
|---|---|
| `src/components/core` | Componentes compartidos del dominio Trackt. |
| `src/components/equipos` | Formularios y vistas de equipos. |
| `src/components/ordenes` | Vistas y formularios de órdenes. |
| `src/components/tickets` | Detalle, timeline y acciones de tickets. |
| `src/components/inventario` | Repuestos, stock, reservas y movimientos. |
| `src/components/layout` | Navegación y layout de app. |
| `src/components/ui` | Componentes base estilo shadcn/ui. |

Hooks relevantes:

| Hook | Uso |
|---|---|
| `use-equipos.ts` | Consulta y mutaciones de equipos. |
| `use-ordenes.ts` | Consulta y mutaciones de órdenes. |
| `use-tickets.ts` | Tickets y acciones operativas. |
| `use-mis-tickets.ts` | Tickets del mecánico. |
| `use-inventario.ts` | Inventario y reservas. |
| `use-notificaciones.ts` | Notificaciones. |
| `use-notificaciones-realtime.ts` | Actualización de notificaciones en tiempo real. |
| `use-usuarios.ts` | Usuarios. |

---

## Validación antes de entregar

Antes de abrir PR o entregar una versión:

```bash
npm run lint
npm run build
```

También revisar manualmente:

- login correcto;
- redirección posterior al login;
- dashboard con API configurada;
- navegación lateral;
- creación de OT;
- creación de ticket desde OT;
- asignación y cambio de estado del ticket;
- carga de evidencias;
- visualización de inventario;
- notificaciones.

---

## Despliegue

El frontend está preparado para desplegarse en Vercel.

Checklist:

- configurar variables de entorno en Vercel;
- confirmar `NEXT_PUBLIC_API_URL` con la URL del backend Railway;
- confirmar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
- ejecutar build local antes del despliegue;
- revisar rutas protegidas después del deploy.

Comando de build:

```bash
npm run build
```

Comando de producción local:

```bash
npm run start
```

---

## Troubleshooting

### Error: `NEXT_PUBLIC_API_URL no esta configurada`

Falta la variable en `.env.local`.

Solución:

```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

Reiniciar el servidor de Next.js después de cambiar variables.

### Login funciona, pero la API responde 401

Posibles causas:

- sesión expirada;
- token no enviado;
- usuario sin profile en backend/Supabase;
- variables Supabase incorrectas.

Revisar:

```txt
src/lib/api/http.ts
src/lib/supabase/client.ts
src/lib/supabase/server.ts
```

### Frontend carga, pero dashboard no muestra datos

Revisar:

- backend corriendo;
- `NEXT_PUBLIC_API_URL` correcto;
- CORS habilitado en backend;
- usuario con tenant y rol válido;
- datos demo cargados.

### Error de build por tipos

Ejecutar:

```bash
npm install
npm run lint
npm run build
```

Si el error viene de contratos con backend, revisar los tipos en `src/lib/api/*` y compararlos con los DTOs del backend.

---

## Notas para desarrollo

- Mantener sincronizados tipos frontend con DTOs/backend.
- Centralizar llamadas HTTP mediante `authFetch`.
- No llamar directamente al backend sin token en rutas protegidas.
- Mantener rutas protegidas dentro del grupo `(app)`.
- Mantener rutas públicas dentro de `(auth)`.
- Documentar nuevas pantallas en este README.
