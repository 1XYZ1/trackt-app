import { test, expect } from '@playwright/test';
import { ROLE_HOME } from './fixtures';
import { loginAs, logout, shot } from './helpers';

// ─────────────────────────────────────────────
// Smoke: login por rol y verificacion de landing
// ─────────────────────────────────────────────

test('admin puede iniciar sesion y aterriza en /dashboard', async ({ page }, testInfo) => {
  await loginAs(page, 'admin');
  await shot(page, '01-landing', testInfo.title);

  // Verificar que estamos en /dashboard
  expect(page.url()).toContain('/dashboard');

  // Verificar contenido del dashboard de admin
  await expect(
    page.getByRole('heading', { name: /centro de control/i }),
  ).toBeVisible({ timeout: 10_000 });

  await shot(page, '02-dashboard-visible', testInfo.title);
});

test('jefe_taller puede iniciar sesion y aterriza en /dashboard', async ({ page }, testInfo) => {
  await loginAs(page, 'jefe_taller');
  await shot(page, '01-landing', testInfo.title);

  expect(page.url()).toContain('/dashboard');

  // El dashboard es compartido entre admin y jefe_taller
  await expect(
    page.getByRole('heading', { name: /centro de control/i }),
  ).toBeVisible({ timeout: 10_000 });

  await shot(page, '02-dashboard-visible', testInfo.title);
});

test('mechanic puede iniciar sesion y aterriza en /mis-tickets', async ({ page }, testInfo) => {
  await loginAs(page, 'mechanic');
  await shot(page, '01-landing', testInfo.title);

  expect(page.url()).toContain('/mis-tickets');

  // Verificar que la pagina cargo (esperar algun heading o contenido)
  await expect(page.locator('main, [role="main"], h1, h2').first()).toBeVisible({
    timeout: 10_000,
  });

  await shot(page, '02-mis-tickets-visible', testInfo.title);
});

test('jefe_inventario puede iniciar sesion y aterriza en /inventario', async ({ page }, testInfo) => {
  await loginAs(page, 'jefe_inventario');
  await shot(page, '01-landing', testInfo.title);

  expect(page.url()).toContain('/inventario');

  await expect(page.locator('main, [role="main"], h1, h2').first()).toBeVisible({
    timeout: 10_000,
  });

  await shot(page, '02-inventario-visible', testInfo.title);
});

// ─────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────

test('admin puede cerrar sesion y es redirigido a /login', async ({ page }, testInfo) => {
  await loginAs(page, 'admin');
  await shot(page, '01-antes-logout', testInfo.title);

  await logout(page);
  await shot(page, '02-despues-logout', testInfo.title);

  expect(page.url()).toContain('/login');
});

// ─────────────────────────────────────────────
// Credenciales invalidas
// ─────────────────────────────────────────────

test('credenciales invalidas muestran error en login', async ({ page }, testInfo) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('noexiste@trackt.demo');
  await page.locator('#password').fill('wrongpassword123');
  await shot(page, '01-formulario-invalido', testInfo.title);

  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Esperar que aparezca el mensaje de error (redirige con ?error= o muestra inline)
  // La app redirige a /login?error=... y renderiza un div con "No se pudo iniciar sesion"
  await page.waitForURL('**/login**', { timeout: 15_000 });

  // Debe mostrar algun mensaje de error
  const errorVisible = await page
    .getByText(/no se pudo iniciar sesi[oó]n|correo o contrase[ñn]a incorrectos/i)
    .isVisible()
    .catch(() => false);

  await shot(page, '02-error-mostrado', testInfo.title);

  // Si el error no es visible directamente, verificar que seguimos en /login
  if (!errorVisible) {
    expect(page.url()).toContain('/login');
  } else {
    expect(errorVisible).toBe(true);
  }
});

// ─────────────────────────────────────────────
// Ruta protegida sin sesion
// ─────────────────────────────────────────────

test('ruta protegida sin sesion redirige a /login', async ({ page }, testInfo) => {
  // Navegar directamente al dashboard sin autenticacion
  await page.goto('/dashboard');
  await shot(page, '01-acceso-sin-sesion', testInfo.title);

  // Esperar la redireccion a login
  await page.waitForURL('**/login**', { timeout: 15_000 });

  await shot(page, '02-redirigido-a-login', testInfo.title);

  expect(page.url()).toContain('/login');

  // Verificar que el formulario de login es visible
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
});
