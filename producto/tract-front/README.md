# Trackt System Design

Demo profesional de interfaz SaaS para mantenimiento minero. El proyecto muestra el sistema visual base de Trackt: landing/demo publica, app shell, dashboard, ordenes de trabajo, sidebar, header, cards, tablas operacionales, paleta y componentes de interfaz.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui + Base UI
- Lucide Icons

## Pantallas

- `/` - Demo publica del System Design
- `/login` - Pantalla de acceso
- `/dashboard` - Centro de control operacional
- `/ordenes` - Tabla de ordenes de trabajo
- `/equipos` - Placeholder de flota
- `/mantenciones` - Placeholder de mantenciones

## Estilo Visual

- SaaS premium
- Industrial/minero
- Tema oscuro
- Componentes densos y operacionales
- Estados por color: success, warning, danger, info y primary

## Requisitos

- Node.js 20+
- npm
- Git

## Desarrollo Local

```bash
npm install
npm run dev
```

Abrir:

```txt
http://localhost:3000
```

## Validacion

```bash
npm run lint
npm run build
```

## Variables De Entorno

Para rutas protegidas con Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

La demo publica `/` no requiere autenticacion.

## Deploy En Vercel

Configuracion recomendada:

```txt
Framework: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: dejar vacio
```

## GitHub

Repositorio:

```txt
trackt-system-design
```

Comandos base:

```bash
git add -A
git commit -m "Mejoras en demo del system design"
git push
```
