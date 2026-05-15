# Trackt Front

Frontend de Trackt: plataforma de mantenimiento industrial.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui + Base UI
- Lucide Icons
- Supabase (auth + DB)

## Pantallas

- `/` - Redirect a `/login`
- `/login` - Pantalla de acceso
- `/dashboard` - Centro de control operacional
- `/ordenes` - Tabla de ordenes de trabajo
- `/equipos` - Flota de equipos
- `/mantenciones` - Mantenciones

## Requisitos

- Node.js 20+
- npm

## Desarrollo Local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Validacion

```bash
npm run lint
npm run build
```

## Variables De Entorno

`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
```
