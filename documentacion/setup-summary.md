# Trackt - Resumen de Setup

## Arquitectura

```
trackt-front (Next.js) → trackt-api (NestJS) → Supabase (PostgreSQL)
     Vercel                  Railway              supabase.co
```

## Repositorios (privados)

| Repo | URL |
|------|-----|
| API | https://github.com/1XYZ1/trackt-api |
| Front | https://github.com/1XYZ1/trackt-front |

## Deployments

| Servicio | Plataforma | URL |
|----------|-----------|-----|
| Frontend | Vercel | https://trackt-front.vercel.app |
| API | Railway | https://trackt-api-production.up.railway.app |

## Supabase

- **Proyecto:** trackt-db
- **Org:** trackt
- **Ref:** `xpaqmqahubpjfnopndff`
- **Región:** East US (North Virginia)
- **Dashboard:** https://supabase.com/dashboard/project/xpaqmqahubpjfnopndff

### Tabla: `messages`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | SERIAL | Primary key |
| text | TEXT | Contenido del mensaje |
| created_at | TIMESTAMPTZ | Fecha de creación (default: NOW()) |

- RLS habilitado
- Policy: lectura pública (`Allow public read`)

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Hello world - health check |
| GET | `/messages` | Lista mensajes desde Supabase |

## Variables de entorno

### API (Railway)

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Anon key de Supabase |

### Frontend (Vercel)

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | URL de la API en Railway |

## Deploy

- **Frontend:** auto-deploy en cada push a `main` (Vercel conectado a GitHub)
- **API:** deploy manual con `railway up` desde el directorio del proyecto, o conectar repo desde Railway dashboard para auto-deploy

## Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS
- **API:** NestJS, TypeScript, @supabase/supabase-js
- **DB:** Supabase (PostgreSQL)
- **Hosting:** Vercel (front), Railway (API)
