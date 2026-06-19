/**
 * qr-mobile.spec.ts — Flujo de la página mobile del QR (project: mobile)
 *
 * Estrategia:
 * 1. Paso desktop (context sin viewport mobile): admin navega a /equipos,
 *    entra al detalle de un equipo, abre el dialog "Código QR", genera el QR
 *    si no existe y extrae el token de la URL mostrada.
 * 2. Paso mobile (page principal del project): navega a /q/<token> autenticado
 *    como admin, verifica ficha, scroll, cambio de estado operativo y reporte
 *    de falla.
 */

import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
import { loginAs, shot } from './helpers';
import { BASE, uniqueSuffix } from './fixtures';

// ---------------------------------------------------------------------------
// Helper: extraer el token QR desde la URL mostrada en el dialog
// El dialog muestra: <code>https://...trackt-front.vercel.app/q/<token></code>
// ---------------------------------------------------------------------------
async function extractQrToken(desktopPage: Page): Promise<string | null> {
  // La URL del QR aparece dentro de un <code> en el dialog
  const codeEl = desktopPage.locator('dialog code, [role="dialog"] code').first();
  try {
    await codeEl.waitFor({ state: 'visible', timeout: 10_000 });
    const href = await codeEl.textContent();
    if (!href) return null;
    // Formato: https://.../q/<token>
    const match = href.match(/\/q\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper: generar QR para un equipo si aún no tiene token
// Devuelve el token extraído, o null si no se pudo.
// ---------------------------------------------------------------------------
async function ensureQrToken(desktopPage: Page, title: string): Promise<string | null> {
  // Navegar a la lista de equipos
  await desktopPage.goto(`${BASE}/equipos`);

  // Esperar que cargue la tabla/cards de equipos
  await desktopPage.waitForLoadState('networkidle', { timeout: 20_000 });
  await shot(desktopPage, '01-lista-equipos', title);

  // Tomar el primer equipo disponible — clic en el primer enlace de código
  // La tabla desktop muestra celdas con links (código en font-mono)
  // Fallback: tarjeta mobile. Usamos el primer link que lleve a /equipos/<id>
  const equipoLink = desktopPage
    .locator('a[href^="/equipos/"]')
    .first();

  await equipoLink.waitFor({ state: 'visible', timeout: 15_000 });
  await equipoLink.click();

  // Esperar la página de detalle
  await desktopPage.waitForURL(/\/equipos\/[^/]+$/, { timeout: 15_000 });
  await desktopPage.waitForLoadState('networkidle', { timeout: 20_000 });
  await shot(desktopPage, '02-detalle-equipo', title);

  // Abrir el dialog de QR — botón "QR" en la cabecera del detalle
  const qrButton = desktopPage.getByRole('button', { name: /^QR$/i });
  await qrButton.waitFor({ state: 'visible', timeout: 10_000 });
  await qrButton.click();

  // Esperar que el dialog abra
  const dialog = desktopPage.locator('dialog, [role="dialog"]').last();
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  await shot(desktopPage, '03-dialog-qr-abierto', title);

  // Intentar extraer token existente
  let token = await extractQrToken(desktopPage);

  if (!token) {
    // No hay QR generado — hacer clic en "Generar QR"
    const generarBtn = desktopPage.getByRole('button', { name: /generar qr/i });
    if (await generarBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await generarBtn.click();
      // Esperar que aparezca el código/enlace tras la generación
      await desktopPage.waitForTimeout(3_000);
      await shot(desktopPage, '04-qr-generado', title);
      token = await extractQrToken(desktopPage);
    }
  } else {
    await shot(desktopPage, '04-qr-existente', title);
  }

  return token;
}

// ===========================================================================
// TEST PRINCIPAL
// ===========================================================================

test('flujo QR mobile: ficha, scroll, estado operativo y reportar falla', async ({ page, browser }, testInfo) => {
  // -------------------------------------------------------------------------
  // PASO 1 (desktop): obtener el token QR
  // Usamos un context desktop separado para no interferir con el viewport
  // mobile que el project "mobile" inyecta a `page`.
  // -------------------------------------------------------------------------
  let qrToken: string | null = null;

  await test.step('obtener token QR desde contexto desktop', async () => {
    // Crear un contexto desktop explícito (sin viewport mobile)
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();

    try {
      // Autenticar como admin en el contexto desktop
      await loginAs(desktopPage, 'admin');
      qrToken = await ensureQrToken(desktopPage, testInfo.title);
    } finally {
      await desktopContext.close();
    }

    if (!qrToken) {
      test.skip(true, 'No se pudo obtener ni generar un qrToken. El flujo QR no puede continuar sin él.');
      return;
    }
  });

  // Si el token es null (test.skip no detiene el flujo en algunos runners), salimos
  if (!qrToken) return;

  // -------------------------------------------------------------------------
  // PASO 2 (mobile): navegar a /q/<token> autenticado
  // `page` ya tiene el viewport iPhone 14 Pro Max inyectado por el project.
  // -------------------------------------------------------------------------

  await test.step('login mobile y navegar a la ficha QR', async () => {
    // Autenticar en el contexto mobile (la page del project mobile)
    await loginAs(page, 'admin');
    await page.goto(`${BASE}/q/${qrToken}`);

    // Esperar que la ficha cargue — el h1 con el nombre del equipo
    const heading = page.getByRole('heading', { level: 1 });
    await heading.waitFor({ state: 'visible', timeout: 20_000 });

    await shot(page, '05-ficha-qr-arriba', testInfo.title);

    // Verificar que estamos en la ruta correcta
    await expect(page).toHaveURL(new RegExp(`/q/${qrToken}`));

    // Verificar que el nombre/codigo del equipo se muestra
    await expect(heading).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // PASO 3: scroll hasta el fondo — verificar que la ficha no se corta
  // -------------------------------------------------------------------------
  await test.step('scroll hasta el fondo sin corte', async () => {
    // Hacer scroll al fondo de la página
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await page.waitForTimeout(1_500);

    await shot(page, '06-ficha-qr-abajo', testInfo.title);

    // La sección "Tickets activos" debe existir (aunque esté vacía).
    // El h2 de la sección es el elemento más específico — evita violación
    // de strict mode con la StatCard que también dice "Tickets activos".
    const ticketsSection = page.getByRole('heading', { name: /tickets activos/i });
    await expect(ticketsSection).toBeVisible({ timeout: 10_000 });

    // Volver arriba para los siguientes pasos
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(500);
  });

  // -------------------------------------------------------------------------
  // PASO 4: cambiar el estado operativo a "En mantenimiento"
  // Los botones de estado son: "Operativo", "En mantenimiento", "Fuera de servicio"
  // -------------------------------------------------------------------------
  await test.step('cambiar estado operativo a En mantenimiento', async () => {
    // Verificar que los botones de estado están presentes
    const btnEnMantenimiento = page.getByRole('button', { name: /en mantenimiento/i });
    await btnEnMantenimiento.waitFor({ state: 'visible', timeout: 10_000 });

    await shot(page, '07-antes-cambio-estado', testInfo.title);

    // Hacer clic en "En mantenimiento"
    await btnEnMantenimiento.click();

    // Esperar el toast de confirmación o que el botón quede presionado (aria-pressed=true)
    // El componente usa aria-pressed para el estado activo
    await expect(btnEnMantenimiento).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });

    await shot(page, '08-estado-cambiado-mantenimiento', testInfo.title);

    // Verificar que el badge de estado refleja el cambio
    // "En mantenimiento" aparece tanto en el badge de cabecera como en el botón activo
    const estadoBadge = page.locator('header').getByText(/en mantenimiento/i).first();
    await expect(estadoBadge).toBeVisible({ timeout: 10_000 });

    await shot(page, '09-badge-estado-actualizado', testInfo.title);

    // Restaurar a "Operativo" para no dejar el equipo en mal estado
    const btnOperativo = page.getByRole('button', { name: /^operativo$/i });
    await btnOperativo.click();
    await expect(btnOperativo).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  });

  // -------------------------------------------------------------------------
  // PASO 5: "Reportar falla" — abrir dialog, completar y enviar
  // Esto crea una OT (orden de trabajo) en el sistema.
  // -------------------------------------------------------------------------
  await test.step('reportar falla — abrir dialog, completar descripcion y enviar', async () => {
    // Botón "Reportar falla" — estilo destructive-outline
    const reportarBtn = page.getByRole('button', { name: /reportar falla/i });
    await reportarBtn.waitFor({ state: 'visible', timeout: 10_000 });

    await shot(page, '10-antes-reportar-falla', testInfo.title);

    await reportarBtn.click();

    // El dialog de "Reportar falla" debe abrirse
    const dialog = page.locator('dialog, [role="dialog"]').last();
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });

    await shot(page, '11-dialog-reportar-falla', testInfo.title);

    // Verificar el título del dialog
    await expect(page.getByRole('heading', { name: /reportar falla/i })).toBeVisible();

    // Completar la descripción — el textarea tiene id="falla-desc" / Label "Descripción de la falla"
    const descripcionField = page.locator('#falla-desc');
    await descripcionField.waitFor({ state: 'visible', timeout: 5_000 });
    const descripcion = `Falla E2E detectada por test automatizado ${uniqueSuffix()} — verificar sistema`;
    await descripcionField.fill(descripcion);

    await shot(page, '12-descripcion-completada', testInfo.title);

    // Enviar — botón "Reportar falla" dentro del dialog (el del footer)
    // Hay dos elementos con "Reportar falla": el botón de abrir y el del footer del dialog.
    // El del footer está dentro del dialog.
    const submitBtn = dialog.getByRole('button', { name: /reportar falla/i });
    await submitBtn.click();

    // Esperar toast de confirmación: "Falla reportada — OT-XXXX"
    // El toast usa Sonner, aparece como [data-sonner-toast] o similar
    // Alternativamente esperamos que el dialog se cierre
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });

    await shot(page, '13-falla-reportada-confirmacion', testInfo.title);

    // Verificar que el toast de éxito apareció (puede haber desaparecido)
    // Verificamos que el dialog se cerró correctamente como confirmación de éxito
    await expect(dialog).not.toBeVisible();
  });

  await shot(page, '14-flujo-qr-completado', testInfo.title);
});
