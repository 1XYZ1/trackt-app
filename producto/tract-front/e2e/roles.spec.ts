/**
 * roles.spec.ts
 *
 * Flujo ROLES / gating:
 *   1. admin  -> /usuarios: form "Invitar" ofrece la opcion "Jefe de inventario" en el selector de rol.
 *   2. mechanic -> /mis-tickets; navegar a /tickets o /inventario debe redirigir (sin acceso).
 *   3. jefe_inventario -> /inventario; sidebar muestra solo sus items; puede abrir /inventario/reservas-pendientes.
 */

import { test, expect } from '@playwright/test';
import { loginAs, shot } from './helpers';

// ─────────────────────────────────────────────────────────────────────────────
// 1. ADMIN: /usuarios → form Invitar → opcion "Jefe de inventario" en el select
// ─────────────────────────────────────────────────────────────────────────────

test('admin: /usuarios tiene opcion "Jefe de inventario" en el selector de rol', async ({
  page,
}, testInfo) => {
  await loginAs(page, 'admin');
  await shot(page, '01-admin-landing', testInfo.title);

  // Navegar a /usuarios
  await page.goto('/usuarios');
  // Esperar que la pagina cargue — h1 "Usuarios" es server-side rendered
  await expect(page.getByRole('heading', { name: /usuarios/i })).toBeVisible({
    timeout: 15_000,
  });
  await shot(page, '02-usuarios-page', testInfo.title);

  // El selector de Rol usa un <Select> con <SelectTrigger id="role">
  // Hacer click en el trigger para abrir el dropdown
  const roleTrigger = page.locator('#role');
  await roleTrigger.waitFor({ state: 'visible', timeout: 10_000 });
  await roleTrigger.click();

  await shot(page, '03-role-select-open', testInfo.title);

  // El listbox / popover con las opciones debe aparecer
  // La opcion "Jefe de inventario" viene del roleLabel('jefe_inventario')
  const opcionJefeInventario = page.getByRole('option', {
    name: /jefe de inventario/i,
  });

  await expect(opcionJefeInventario).toBeVisible({ timeout: 8_000 });
  await shot(page, '04-jefe-inventario-option-visible', testInfo.title);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. MECHANIC: redireccion al intentar acceder a /tickets e /inventario
// ─────────────────────────────────────────────────────────────────────────────

test('mechanic: login aterriza en /mis-tickets', async ({ page }, testInfo) => {
  await loginAs(page, 'mechanic');
  await shot(page, '01-mechanic-landing', testInfo.title);

  expect(page.url()).toContain('/mis-tickets');

  // Verificar que la pagina cargo bien
  await expect(page.locator('main, [role="main"], h1, h2').first()).toBeVisible({
    timeout: 10_000,
  });

  await shot(page, '02-mis-tickets-visible', testInfo.title);
});

test('mechanic: /tickets no tiene guard server-side — pagina carga pero sidebar NO muestra enlace Tickets', async ({
  page,
}, testInfo) => {
  await loginAs(page, 'mechanic');

  // Navegar a /tickets — esta pagina no tiene requireRole, cualquier
  // usuario autenticado puede visitarla. El gating es solo de UI (sidebar).
  await page.goto('/tickets');

  // Esperar que la pagina cargue (layout completo, no redireccion)
  await page.waitForURL('**/tickets', { timeout: 10_000 });

  await shot(page, '01-mechanic-en-tickets', testInfo.title);

  // La pagina renderiza pero la URL sigue siendo /tickets (sin redireccion)
  expect(page.url()).toContain('/tickets');

  // El sidebar NO debe mostrar el enlace "Tickets" para mechanic
  // (segun sidebar-data.ts, Tickets solo aparece para admin/jefe_taller)
  const ticketsLink = page.getByRole('link', { name: /^tickets$/i });
  await expect(ticketsLink).not.toBeVisible();

  await shot(page, '02-sidebar-sin-link-tickets', testInfo.title);
});

test('mechanic: acceder a /inventario redirige a /mis-tickets (guard server-side)', async ({
  page,
}, testInfo) => {
  await loginAs(page, 'mechanic');

  // /inventario tiene requireRole("admin","jefe_taller","jefe_inventario")
  // mechanic no esta en esa lista → el servidor redirige a su home (/mis-tickets)
  await page.goto('/inventario');

  // Esperar la redireccion: debe salir de /inventario
  await page.waitForURL((url) => !url.pathname.startsWith('/inventario'), {
    timeout: 20_000,
  });

  await shot(page, '01-inventario-redirigido', testInfo.title);

  // No debe estar en /inventario
  expect(page.url()).not.toContain('/inventario');

  // Debe haber aterrizado en /mis-tickets
  expect(page.url()).toContain('/mis-tickets');

  await shot(page, '02-mechanic-redirigido-desde-inventario', testInfo.title);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. JEFE_INVENTARIO: sidebar, gating y reservas-pendientes
// ─────────────────────────────────────────────────────────────────────────────

test('jefe_inventario: login aterriza en /inventario y sidebar muestra solo sus items', async ({
  page,
}, testInfo) => {
  await loginAs(page, 'jefe_inventario');
  await shot(page, '01-jefe-inv-landing', testInfo.title);

  expect(page.url()).toContain('/inventario');

  // Esperar que el sidebar este visible (nav lateral)
  const sidebar = page.locator('nav, [data-sidebar], aside').first();
  await sidebar.waitFor({ state: 'visible', timeout: 10_000 });

  await shot(page, '02-sidebar-visible', testInfo.title);

  // ── Items que DEBEN aparecer en el sidebar ──
  // Segun sidebar-data.ts, jefe_inventario ve el grupo "Inventario" con:
  //   - Inventario (/inventario)
  //   - Movimientos (/inventario/movimientos)
  //   - Solicitudes pendientes (/inventario/reservas-pendientes)
  await expect(page.getByRole('link', { name: /^inventario$/i }).first()).toBeVisible({
    timeout: 8_000,
  });
  await expect(
    page.getByRole('link', { name: /movimientos/i }).first(),
  ).toBeVisible({ timeout: 8_000 });
  await expect(
    page.getByRole('link', { name: /solicitudes pendientes/i }).first(),
  ).toBeVisible({ timeout: 8_000 });

  await shot(page, '03-sidebar-items-inventario-visibles', testInfo.title);

  // ── Items que NO deben aparecer ──
  // Dashboard y Tickets estan en el grupo "General" -> solo admin/jefe_taller
  await expect(
    page.getByRole('link', { name: /^dashboard$/i }),
  ).not.toBeVisible();
  await expect(
    page.getByRole('link', { name: /^tickets$/i }),
  ).not.toBeVisible();
  // Ordenes -> solo admin/jefe_taller
  await expect(
    page.getByRole('link', { name: /^ordenes$/i }),
  ).not.toBeVisible();
  // Usuarios -> solo admin
  await expect(
    page.getByRole('link', { name: /^usuarios$/i }),
  ).not.toBeVisible();

  await shot(page, '04-sidebar-items-prohibidos-no-visibles', testInfo.title);
});

test('jefe_inventario: /tickets no tiene guard server-side — pagina carga pero sidebar NO muestra enlace Tickets ni Dashboard', async ({
  page,
}, testInfo) => {
  await loginAs(page, 'jefe_inventario');

  // /tickets no tiene requireRole; cualquier usuario autenticado puede verla.
  // El gating es de UI via sidebar (jefe_inventario no ve el link Tickets).
  await page.goto('/tickets');

  // Esperar que la pagina cargue — la URL se mantiene en /tickets
  await page.waitForURL('**/tickets', { timeout: 10_000 });

  await shot(page, '01-jefe-inv-en-tickets', testInfo.title);

  expect(page.url()).toContain('/tickets');

  // El sidebar NO debe mostrar enlace "Tickets" (solo admin/jefe_taller)
  const ticketsLink = page.getByRole('link', { name: /^tickets$/i });
  await expect(ticketsLink).not.toBeVisible();

  // El sidebar NO debe mostrar "Dashboard" (solo admin/jefe_taller)
  const dashboardLink = page.getByRole('link', { name: /^dashboard$/i });
  await expect(dashboardLink).not.toBeVisible();

  await shot(page, '02-sidebar-sin-tickets-ni-dashboard', testInfo.title);

  // Verificar que la URL es estable (no hay loop)
  const urlSnapshot = page.url();
  await page.waitForTimeout(1_500);
  expect(page.url()).toBe(urlSnapshot);

  await shot(page, '03-url-estable-sin-loop', testInfo.title);
});

test('jefe_inventario: puede abrir /inventario/reservas-pendientes', async ({
  page,
}, testInfo) => {
  await loginAs(page, 'jefe_inventario');
  await shot(page, '01-jefe-inv-landing', testInfo.title);

  // Navegar directamente a /inventario/reservas-pendientes
  await page.goto('/inventario/reservas-pendientes');

  // Verificar que la pagina cargo (no hubo redireccion fuera)
  await expect(page).toHaveURL(/inventario\/reservas-pendientes/, {
    timeout: 15_000,
  });

  // Esperar algun contenido en la pagina
  await expect(page.locator('main, [role="main"], h1, h2').first()).toBeVisible({
    timeout: 10_000,
  });

  await shot(page, '02-reservas-pendientes-cargada', testInfo.title);

  // Screenshot del sidebar para constancia
  await shot(page, '03-sidebar-en-reservas-pendientes', testInfo.title);
});
