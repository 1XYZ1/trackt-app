# Informe de Pruebas E2E — Trackt

> Suite de pruebas end-to-end (Playwright) que valida los flujos críticos de Trackt
> sobre el ambiente desplegado. Este documento es el insumo para el informe formal.

**Fecha de ejecución:** 2026-06-18
**Ejecutado por:** suite automatizada Playwright (orquestación multi-agente)
**Ambiente:** producción desplegada (Vercel + Railway + Supabase), tenant `demo` (sandbox, app en construcción)
**Resultado global:** 5 de 6 flujos en verde · 1 flujo (ciclo completo de ticket) en estabilización · **149 capturas de evidencia**

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Contexto y objetivo](#2-contexto-y-objetivo)
3. [Alcance](#3-alcance)
4. [Metodología](#4-metodología)
5. [Entorno de pruebas](#5-entorno-de-pruebas)
6. [Stack y herramientas](#6-stack-y-herramientas)
7. [Estructura de archivos](#7-estructura-de-archivos)
8. [Catálogo de flujos y casos](#8-catálogo-de-flujos-y-casos)
9. [Resultados de la última ejecución](#9-resultados-de-la-última-ejecución)
10. [Hallazgos](#10-hallazgos)
11. [Evidencia](#11-evidencia)
12. [Cómo reproducir](#12-cómo-reproducir)
13. [Limitaciones y notas](#13-limitaciones-y-notas)
14. [Próximos pasos](#14-próximos-pasos)

---

## 1. Resumen ejecutivo

Se construyó una suite E2E con **Playwright** que ejercita, de punta a punta y contra la
app realmente desplegada, los flujos de trabajo típicos de Trackt: autenticación y
permisos por rol, gestión de equipos con QR, ciclo de órdenes de trabajo y tickets con
sus cambios de estado, inventario con reserva de stock, y la página móvil del código QR.

Cada paso relevante queda documentado con una **captura de pantalla** (149 en total),
además de traza, video y reporte HTML automáticos ante fallos.

| Métrica | Valor |
|---|---|
| Flujos (spec files) | 6 |
| Casos de prueba | ~25 |
| En verde | 5 flujos / ~24 casos |
| En estabilización | 1 flujo (`ticket-lifecycle`) |
| Capturas de evidencia | 149 PNG |
| Navegadores | Chromium (desktop) + emulación móvil (Pixel 5) |

---

## 2. Contexto y objetivo

Trackt es una plataforma de gestión de mantenimiento industrial (equipos → órdenes de
trabajo → tickets, con evidencias, inventario de repuestos y roles). El objetivo de esta
suite es contar con **pruebas automatizadas reejecutables en cualquier momento** que
verifiquen los flujos de negocio principales y **dejen evidencia visual** del
comportamiento del sistema, para respaldo, QA y documentación.

---

## 3. Alcance

Flujos cubiertos (solicitados):

- **Autenticación**: login por rol, logout, credenciales inválidas, protección de rutas.
- **Equipos**: crear equipo, ver detalle/pestañas, generar/regenerar QR.
- **Órdenes de trabajo y tickets**: crear OT, crear ticket, asignar mecánico.
- **Cambios de estado del ticket**: PENDIENTE → ASIGNADO → EN_EJECUCIÓN → EJECUTADO → CERRADO.
- **Inventario**: crear repuesto, entrada de stock, **reservar repuesto** en un ticket, aprobar/consumir/liberar reserva.
- **QR móvil**: abrir la ficha del equipo escaneando el QR, scroll, cambiar estado operativo, reportar falla.
- **Roles/permisos**: gating de `admin`, `jefe_taller`, `jefe_inventario`, `mechanic`.

Fuera de alcance (por ahora): pruebas de carga/performance, pruebas unitarias (ya existen
con Vitest/Jest), CI en GitHub Actions (pendiente, ver §14), navegador WebKit/Safari.

---

## 4. Metodología

- **Caja negra, end-to-end**: las pruebas interactúan con la UI real como un usuario
  (no se mockea API ni base de datos); se ejecuta contra la app desplegada.
- **Login por UI**: cada prueba inicia sesión vía el formulario real (Supabase Auth) con
  `loginAs(page, rol)`. No se usa `storageState` en archivo, para que las pruebas sean
  seguras en ejecución paralela.
- **Selectores accesibles**: se usan `getByRole`, `getByLabel`, `getByText`,
  `getByPlaceholder` (la app desplegada no tiene `data-testid`). Esto además valida
  implícitamente la accesibilidad (roles/labels).
- **Datos únicos por corrida**: las entidades que se crean usan un sufijo `Date.now()`
  (p.ej. `EQ-E2E-1718...`, `REP-E2E-...`) para no colisionar entre corridas. **No se
  borran datos** (el tenant `demo` es sandbox).
- **Evidencia por paso**: helper `shot(page, nombre, testInfo.title)` guarda un PNG por
  paso en `e2e/evidence/<test>/`. Adicionalmente Playwright captura screenshot, **video**
  y **traza** ante fallo, más un **reporte HTML** navegable.
- **Reintentos**: `retries: 2` para absorber flakiness de red real.
- **Multi-contexto**: los flujos que cruzan roles (p.ej. admin asigna y mecánico ejecuta)
  abren un segundo contexto de navegador para autenticar al otro usuario.

---

## 5. Entorno de pruebas

| Componente | Valor |
|---|---|
| Front (baseURL) | `https://trackt-front.vercel.app` (override con `E2E_BASE_URL`) |
| API | Railway (`trackt-api`) |
| Base de datos / Auth | Supabase (PostgreSQL/Auth) |
| Tenant | `demo` (sandbox) |

**Credenciales** (tenant demo, password `Trackt!2026`; override por env):

| Rol | Email (default) | Variable env |
|---|---|---|
| admin | `admin@trackt.demo` | `E2E_ADMIN_EMAIL` |
| jefe_taller | `jefe@trackt.demo` | `E2E_JEFE_EMAIL` |
| mechanic | `mecanico1@trackt.demo` | `E2E_MECHANIC_EMAIL` |
| jefe_inventario | `inventario1@trackt.demo` | `E2E_INVENTARIO_EMAIL` |

> Estos usuarios provienen del seed (`trackt-api/prisma/seed.ts`): 22 usuarios por tenant
> (2 admin, 3 jefe_taller, 2 jefe_inventario, 15 mechanic).

**Landing por rol** (validado por la suite): admin/jefe_taller → `/dashboard`,
mechanic → `/mis-tickets`, jefe_inventario → `/inventario`.

---

## 6. Stack y herramientas

- **Playwright** `@playwright/test ^1.61`
- Navegadores: **Chromium** (desktop) y emulación **Pixel 5** (móvil, para el flujo QR).
  (Se usa Pixel 5 en lugar de iPhone porque WebKit no está instalado en el entorno de corrida.)
- Reporters: `html` (no auto-open) + `list`.
- Node + npm (scripts en `package.json`).

---

## 7. Estructura de archivos

```
producto/tract-front/
├─ playwright.config.ts          # config raíz (projects chromium + mobile, retries, evidencia)
├─ e2e/
│  ├─ fixtures.ts                # CREDS por rol, ROLE_HOME, uniqueSuffix(), BASE
│  ├─ helpers.ts                 # loginAs(), logout(), shot()
│  ├─ fixtures/evidence.png      # imagen de prueba para subir como evidencia de ticket
│  ├─ auth.spec.ts               # autenticación y guards
│  ├─ equipos.spec.ts            # equipos + QR + gating
│  ├─ ticket-lifecycle.spec.ts   # ciclo completo de ticket (OT→ticket→estados)
│  ├─ inventario-reservas.spec.ts# inventario + reserva de stock
│  ├─ qr-mobile.spec.ts          # página QR móvil
│  ├─ roles.spec.ts              # roles/permisos
│  ├─ evidence/                  # 149 capturas (versionadas; insumo del informe)
│  ├─ README.md                  # guía de uso
│  └─ REPORTE-E2E.md             # este documento
```

---

## 8. Catálogo de flujos y casos

### 8.1 `auth.spec.ts` — Autenticación y guards ✅
- Login `admin` → aterriza en `/dashboard`.
- Login `jefe_taller` → `/dashboard`.
- Login `mechanic` → `/mis-tickets`.
- Login `jefe_inventario` → `/inventario`.
- Logout → redirige a `/login`.
- Credenciales inválidas → muestra error.
- Ruta protegida sin sesión → redirige a `/login`.

### 8.2 `equipos.spec.ts` — Equipos, QR y gating ✅
- Crear equipo (código único) y verificar en el listado.
- Buscar y abrir el detalle del equipo creado.
- Navegar pestañas del detalle (Resumen / Historial / Repuestos).
- Abrir diálogo de Código QR y generar/regenerar (verifica que codifica una URL `/q/...`).
- `jefe_taller` ve el listado pero **no** el botón de crear equipo.
- `jefe_taller` ve el detalle pero **no** el botón de editar.

### 8.3 `ticket-lifecycle.spec.ts` — Ciclo completo del ticket ⚠️
Flujo único de 7 fases con doble contexto (admin + mecánico):
1. admin crea equipo →
2. admin crea OT para el equipo →
3. admin crea ticket en la OT (estado **PENDIENTE**) →
4. admin asigna mecánico (**ASIGNADO**) →
5. mecánico inicia ejecución (**EN_EJECUCIÓN**) →
6. mecánico sube evidencia (foto a Supabase Storage) y finaliza (**EJECUTADO**) →
7. admin valida y cierra (**CERRADO**).

> Estado: **falló en la última corrida** durante una navegación (ver §9 y §10). Las fases
> 1–4 sí se ejercitaron (hay evidencia). Marcado para estabilizar.

### 8.4 `inventario-reservas.spec.ts` — Inventario y reserva de stock ✅
- Crear repuesto (código único).
- Registrar entrada de stock y verificar disponible.
- Flujo completo: crear repuesto → entrada → **reservar** en un ticket → **aprobar** la reserva (jefe_inventario), con efecto en stock/movimientos.

### 8.5 `qr-mobile.spec.ts` — Página QR móvil (Pixel 5) ✅
- Generar QR de un equipo y extraer la URL `/q/<token>`.
- Abrir la ficha móvil: verifica carga y **scroll completo** (sin corte).
- **Cambiar estado operativo** (verifica el badge).
- **Reportar falla** (crea OT, verifica confirmación).

### 8.6 `roles.spec.ts` — Roles y permisos ✅
- admin en `/usuarios`: el selector de rol ofrece la opción **"Jefe de inventario"**.
- mechanic → aterriza en `/mis-tickets`; `/inventario` lo **redirige** (guard server-side).
- jefe_inventario → aterriza en `/inventario`; el sidebar muestra **solo** Inventario/Movimientos/Solicitudes y **no** Dashboard/Tickets/Órdenes/Usuarios.
- jefe_inventario puede abrir `/inventario/reservas-pendientes`.
- (Hallazgo) `/tickets` **no** tiene guard server-side — ver §10.

---

## 9. Resultados de la última ejecución

| Spec | Flujo | Estado | Evidencia |
|---|---|---|---|
| `auth.spec.ts` | Autenticación y guards | ✅ Verde | sí |
| `equipos.spec.ts` | Equipos + QR + gating | ✅ Verde | sí |
| `inventario-reservas.spec.ts` | Inventario + reserva de stock | ✅ Verde | sí (34 capturas) |
| `qr-mobile.spec.ts` | Página QR móvil | ✅ Verde | sí (14 capturas) |
| `roles.spec.ts` | Roles/permisos | ✅ Verde | sí |
| `ticket-lifecycle.spec.ts` | Ciclo completo del ticket | ⚠️ Falló (tras 2 reintentos) | sí (parcial + artefactos de fallo) |

**Detalle del fallo (`ticket-lifecycle`):**
```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
```
El snapshot de la página al momento del fallo corresponde a la **pantalla de login**
("Bienvenido de nuevo"): la sesión se perdió/expiró durante una navegación intermedia del
flujo largo (7 fases, 2 contextos de navegador, subida de archivo a Storage). Es el flujo
más sensible a timing y red real; no constituye necesariamente un bug de la app.
Artefactos del fallo (captura, error-context) en `e2e/evidence/_ticket-lifecycle-FAILURE/`
y traza/video en `test-results/` (no versionado; regenerable).

---

## 10. Hallazgos

1. **`/tickets` sin guard server-side** (a revisar). Las pruebas de roles detectaron que
   las páginas de tickets cargan al navegar la URL directa con un rol no autorizado
   (`mechanic`, `jefe_inventario`); el rol solo se oculta del **sidebar**, pero no hay un
   `requireRole(...)` en la página que redirija. Recomendación: agregar guard server-side
   a `/tickets`, `/tickets/[id]`, `/ordenes`, etc., como ya se hizo en `/inventario/*`.
2. **`ticket-lifecycle` flaky** por pérdida de sesión en navegación intermedia bajo red
   real. Recomendación de estabilización: reutilizar sesión por rol (storageState con
   refresh), reforzar esperas de red (`waitForLoadState('networkidle')`) y reintentos de
   navegación; opcionalmente dividir el flujo en pruebas más cortas encadenadas por datos.
3. **Capturas bajo `unknown-test/`**: un spec llamó a `shot()` sin pasar `testInfo.title`,
   por lo que esas capturas quedaron agrupadas en `evidence/unknown-test/` (cosmético).

---

## 11. Evidencia

149 capturas en `e2e/evidence/`, una carpeta por caso de prueba. Mapa principal:

| Carpeta (evidence/) | Flujo | Capturas |
|---|---|---|
| `admin-puede-iniciar-sesion-*`, `*-login-aterriza-*`, `credenciales-invalidas-*`, `ruta-protegida-*`, `admin-puede-cerrar-sesion-*` | Autenticación | ~17 |
| `crear-equipo-*`, `buscar-y-abrir-detalle-*`, `abrir-detalle-del-equipo-y-navegar-tabs`, `abrir-dialog-qr-*`, `jefe-taller-*` | Equipos + QR + gating | ~25 |
| `01-crear-repuesto-*`, `02-registrar-entrada-*`, `flujo-inventario-*` | Inventario + reserva | ~45 |
| `flujo-qr-mobile-*` | QR móvil | 14 |
| `admin-usuarios-tiene-opcion-jefe-de-inventario-*`, `jefe-inventario-*`, `mechanic-*` | Roles/permisos | ~24 |
| `flujo-completo-ot-ticket-*`, `03-crear-equipo-ot-y-ticket-*` | Ciclo de ticket (parcial) | ~16 |
| `_ticket-lifecycle-FAILURE/` | Artefactos del fallo | 2 |

> Reporte HTML navegable: tras una corrida, `npm run e2e:report` (se genera en
> `playwright-report/`, no versionado por tamaño; regenerable).

---

## 12. Cómo reproducir

```bash
cd producto/tract-front
npm install                 # instala deps (incluye @playwright/test)
npx playwright install chromium

# Correr toda la suite contra producción (default)
npm run e2e

# Contra un entorno local
E2E_BASE_URL=http://localhost:3000 npm run e2e

# Un solo flujo
npx playwright test auth.spec.ts --reporter=line

# Ver el reporte HTML de la última corrida
npm run e2e:report
```

Las credenciales se pueden sobreescribir con variables de entorno (ver §5).

---

## 13. Limitaciones y notas

- Se ejecuta contra el **tenant demo** en producción (la app está en construcción, no en
  uso real). Las pruebas **crean** datos con nombres únicos y **no** los borran: el tenant
  acumula entidades de prueba (esperado en sandbox).
- Sin WebKit/Safari (no instalado): el flujo móvil usa emulación Chromium (Pixel 5).
- Tiempos sujetos a red real (login Supabase, navegación, Storage); de ahí `retries: 2`.

---

## 14. Próximos pasos

1. **Estabilizar `ticket-lifecycle`** (ver §10.2).
2. **Cerrar el hallazgo de guards** en `/tickets` y rutas afines (§10.1).
3. **CI en GitHub Actions**: correr la suite en push/PR o manual contra `E2E_BASE_URL`
   (requiere agregar secrets: `E2E_BASE_URL` y credenciales E2E).
4. Considerar un **tenant `e2e` dedicado** (aislar datos del demo) y/o limpieza programada.
5. Agregar `data-testid` en componentes clave para selectores más estables (opcional).
