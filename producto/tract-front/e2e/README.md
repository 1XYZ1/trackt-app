# E2E Tests — Trackt Front (Playwright)

Pruebas end-to-end con **Playwright** que validan los flujos críticos de Trackt contra la
app desplegada, dejando **evidencia visual** (capturas por paso).

> 📄 **Informe detallado** (metodología, casos, resultados, hallazgos): [`REPORTE-E2E.md`](./REPORTE-E2E.md)

## Estado actual (última corrida 2026-06-18)

| Flujo | Spec | Estado |
|---|---|---|
| Autenticación y guards | `auth.spec.ts` | ✅ |
| Equipos + QR + gating | `equipos.spec.ts` | ✅ |
| Inventario + reserva de stock | `inventario-reservas.spec.ts` | ✅ |
| QR móvil | `qr-mobile.spec.ts` | ✅ |
| Roles/permisos | `roles.spec.ts` | ✅ |
| Ciclo completo de ticket | `ticket-lifecycle.spec.ts` | ⚠️ en estabilización |

## Cómo correr

```bash
cd producto/tract-front
npm install
npx playwright install chromium

# Toda la suite contra producción (https://trackt-front.vercel.app)
npm run e2e

# Contra entorno local
E2E_BASE_URL=http://localhost:3000 npm run e2e

# Un solo spec
npx playwright test auth.spec.ts --reporter=line

# UI interactiva (debug)
npm run e2e:ui

# Ver reporte HTML de la última corrida
npm run e2e:report
```

## Credenciales (tenant demo)

Defaults del seed; se pueden sobreescribir por variable de entorno. Password `Trackt!2026`.

| Variable | Default | Rol |
|---|---|---|
| `E2E_ADMIN_EMAIL` | `admin@trackt.demo` | admin |
| `E2E_JEFE_EMAIL` | `jefe@trackt.demo` | jefe_taller |
| `E2E_MECHANIC_EMAIL` | `mecanico1@trackt.demo` | mechanic |
| `E2E_INVENTARIO_EMAIL` | `inventario1@trackt.demo` | jefe_inventario |
| `E2E_PASSWORD` | `Trackt!2026` | todos |
| `E2E_BASE_URL` | `https://trackt-front.vercel.app` | URL base |

## Estructura

```
e2e/
  fixtures.ts      # CREDS, ROLE_HOME, uniqueSuffix(), BASE
  helpers.ts       # loginAs(page, role), logout(page), shot(page, name, testTitle)
  fixtures/        # evidence.png (imagen para subir como evidencia de ticket)
  *.spec.ts        # los 6 flujos
  evidence/        # capturas por test (VERSIONADAS — insumo del informe)
  REPORTE-E2E.md   # informe detallado
  README.md        # esta guía
playwright.config.ts  # projects: chromium (desktop) + mobile (Pixel 5, solo qr-mobile)
```

## Evidencia

- Capturas por paso en `e2e/evidence/<nombre-del-test>/NN-paso.png` (**versionadas** a
  propósito como insumo del informe).
- Ante fallo: screenshot + **video** + **traza** automáticos en `test-results/`
  (no versionado, regenerable) y reporte HTML en `playwright-report/` (`npm run e2e:report`).

## Convenciones para escribir un spec

```ts
import { test, expect } from '@playwright/test';
import { loginAs, logout, shot } from './helpers';
import { uniqueSuffix } from './fixtures';

test('mi flujo', async ({ page }, testInfo) => {
  await loginAs(page, 'admin');
  await shot(page, '01-landing', testInfo.title);   // pasar testInfo.title agrupa bien la evidencia

  const codigo = `EQ-E2E-${uniqueSuffix()}`;          // nombres únicos por corrida
  // ... crear/verificar
});
```

- Selectores **accesibles** (`getByRole`/`getByLabel`/`getByText`); la app en prod no usa `data-testid`.
- Datos con sufijo único; **no** borrar (tenant demo es sandbox).
- Para flujos multi-rol, abrir un segundo `browser.newContext()` y `loginAs` ahí.

## Notas

- Móvil emulado con Pixel 5 (Chromium); WebKit/Safari no está instalado en el entorno.
- Hallazgos abiertos y próximos pasos: ver [`REPORTE-E2E.md`](./REPORTE-E2E.md) §10–§14.
