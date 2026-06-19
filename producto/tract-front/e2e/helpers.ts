import path from 'path';
import { expect, type Page } from '@playwright/test';
import { CREDS, ROLE_HOME, type Role } from './fixtures';

/** Contador global de screenshots por test (reiniciado por test via shot()) */
const _shotCounters = new Map<string, number>();

/**
 * loginAs — hace login por UI (formulario email/password de Supabase)
 * y espera la ruta de aterrizaje correcta para el rol.
 * No usa storageState en archivo para ser parallel-safe.
 */
export async function loginAs(page: Page, role: Role): Promise<void> {
  await page.goto('/login');

  // Esperar que el formulario sea visible
  await page.getByLabel('Correo electrónico').waitFor({ state: 'visible' });

  await page.getByLabel('Correo electrónico').fill(CREDS[role].email);
  // El label "Contraseña" también aplica al botón "Mostrar contraseña" via aria-label,
  // por eso usamos el id del input directamente para ser precisos.
  await page.locator('#password').fill(CREDS[role].password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  // Esperar la redirección al landing del rol
  const expectedPath = ROLE_HOME[role];
  await page.waitForURL((url) => url.pathname.startsWith(expectedPath), {
    timeout: 15_000,
  });

  // Verificar que la página cargó correctamente
  await expect(page).toHaveURL(new RegExp(expectedPath));
}

/**
 * logout — cierra sesión mediante el botón "Cerrar sesion" del header.
 * Espera redirección a /login.
 */
export async function logout(page: Page): Promise<void> {
  const logoutBtn = page.getByRole('button', { name: /cerrar sesi[oó]n/i });
  await logoutBtn.waitFor({ state: 'visible' });
  await logoutBtn.click();
  await page.waitForURL('**/login', { timeout: 10_000 });
}

/**
 * shot — guarda un screenshot en e2e/evidence/<nombre-del-test>/<name>.png
 *
 * Uso:
 *   import { test } from '@playwright/test';
 *   import { shot } from './helpers';
 *
 *   test('mi test', async ({ page }, testInfo) => {
 *     await shot(page, '01-paso', testInfo.title);
 *   });
 *
 * O bien, pasar testInfo.title como tercer argumento para el nombre de carpeta.
 * Si se omite, usa 'unknown-test'.
 */
export async function shot(
  page: Page,
  name: string,
  testTitle?: string,
): Promise<void> {
  // Sanitizar el nombre del test para usarlo como nombre de carpeta
  const rawTitle = testTitle ?? 'unknown-test';
  const testFolder = rawTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Sanitizar el nombre del screenshot
  const safeName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const screenshotPath = path.join(
    // __dirname es e2e/
    __dirname,
    'evidence',
    testFolder,
    `${safeName}.png`,
  );

  await page.screenshot({ path: screenshotPath, fullPage: false });
}
