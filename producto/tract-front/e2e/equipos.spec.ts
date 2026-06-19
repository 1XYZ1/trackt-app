import { test, expect } from '@playwright/test';
import { loginAs, shot } from './helpers';
import { uniqueSuffix } from './fixtures';

// ─────────────────────────────────────────────────────────────
// Helpers locales
// ─────────────────────────────────────────────────────────────

/**
 * Crea un equipo via UI como admin y retorna la URL del detalle.
 * Reutilizado por tests que necesitan un equipo propio.
 */
async function crearEquipoComoAdmin(
  page: Parameters<Parameters<typeof test>[1]>[0]['page'],
  opts: { codigo: string; nombre: string; marca: string; modelo: string; ubicacion: string },
): Promise<string> {
  await page.goto('/equipos');
  await page.waitForURL('**/equipos', { timeout: 15_000 });

  const btnAgregar = page.getByRole('button', { name: /agregar equipo/i });
  await btnAgregar.waitFor({ state: 'visible', timeout: 10_000 });
  await btnAgregar.click();

  await expect(page.getByRole('heading', { name: /nuevo equipo/i })).toBeVisible({
    timeout: 8_000,
  });

  await page.locator('#codigo').fill(opts.codigo);
  await page.locator('#nombre').fill(opts.nombre);
  await page.locator('#marca').fill(opts.marca);
  await page.locator('#modelo').fill(opts.modelo);
  await page.locator('#ubicacion').fill(opts.ubicacion);

  await page.getByRole('button', { name: /crear equipo/i }).click();

  // Sheet cierra al guardar exitosamente
  await expect(page.getByRole('heading', { name: /nuevo equipo/i })).not.toBeVisible({
    timeout: 15_000,
  });

  // Buscar el equipo recien creado para obtener su URL de detalle
  const searchInput = page.getByLabel('Buscar equipos');
  await searchInput.waitFor({ state: 'visible', timeout: 10_000 });
  await searchInput.fill(opts.codigo);
  await page.waitForTimeout(1_000); // debounce 300ms + carga

  const enlace = page.getByRole('link', { name: opts.codigo }).first();
  await expect(enlace).toBeVisible({ timeout: 10_000 });
  const href = await enlace.getAttribute('href') ?? '/equipos';
  return href;
}

// ─────────────────────────────────────────────────────────────
// FLUJO EQUIPOS — Admin
// ─────────────────────────────────────────────────────────────

test.describe('Equipos — Admin', () => {
  test('crear equipo y verificar en listado', async ({ page }, testInfo) => {
    const s = uniqueSuffix();
    const codigo = `EQ-E2E-${s}`;
    const nombre = `Equipo E2E ${s}`;

    await loginAs(page, 'admin');
    await page.goto('/equipos');
    await page.waitForURL('**/equipos', { timeout: 15_000 });

    const btnAgregar = page.getByRole('button', { name: /agregar equipo/i });
    await btnAgregar.waitFor({ state: 'visible', timeout: 10_000 });

    // Screenshot: listado inicial con boton crear
    await shot(page, '01-listado-con-boton-crear', testInfo.title);

    await btnAgregar.click();

    await expect(page.getByRole('heading', { name: /nuevo equipo/i })).toBeVisible({
      timeout: 8_000,
    });

    await page.locator('#codigo').fill(codigo);
    await page.locator('#nombre').fill(nombre);
    await page.locator('#marca').fill('CAT');
    await page.locator('#modelo').fill(`320-${s.slice(-4)}`);
    await page.locator('#ubicacion').fill(`Zona-E2E-${s.slice(-4)}`);

    // Screenshot: formulario relleno
    await shot(page, '02-form-relleno', testInfo.title);

    await page.getByRole('button', { name: /crear equipo/i }).click();

    // Sheet se cierra tras guardar
    await expect(page.getByRole('heading', { name: /nuevo equipo/i })).not.toBeVisible({
      timeout: 15_000,
    });

    // Buscar el equipo para confirmar que existe en el listado
    const searchInput = page.getByLabel('Buscar equipos');
    await searchInput.waitFor({ state: 'visible', timeout: 10_000 });
    await searchInput.fill(codigo);
    await page.waitForTimeout(1_000);

    // El codigo aparece como link en la tabla (strict: usar .first() por mobile/desktop duality)
    const enlaceCodigo = page.getByRole('link', { name: codigo }).first();
    await expect(enlaceCodigo).toBeVisible({ timeout: 10_000 });

    // Screenshot: equipo en listado
    await shot(page, '03-equipo-en-listado', testInfo.title);
  });

  test('abrir detalle del equipo y navegar tabs', async ({ page }, testInfo) => {
    const s = uniqueSuffix();
    const codigo = `EQ-E2E-${s}`;
    const nombre = `Equipo E2E ${s}`;

    await loginAs(page, 'admin');

    const detalleHref = await crearEquipoComoAdmin(page, {
      codigo,
      nombre,
      marca: 'Komatsu',
      modelo: `PC300-${s.slice(-4)}`,
      ubicacion: `Zona-Tabs-${s.slice(-4)}`,
    });

    // Screenshot: listado filtrado tras crear
    await shot(page, '01-listado-filtrado', testInfo.title);

    // Navegar directamente al detalle
    await page.goto(detalleHref);
    await page.waitForURL(/\/equipos\/[^/]+$/, { timeout: 15_000 });

    // Verificar que cargo el detalle
    await expect(page.getByRole('heading', { name: nombre })).toBeVisible({
      timeout: 10_000,
    });

    // Screenshot: detalle del equipo
    await shot(page, '02-detalle-equipo', testInfo.title);

    // ── Navegacion de tabs ──

    // Tab Resumen (activa por defecto)
    const tabResumen = page.getByRole('tab', { name: /resumen/i });
    await expect(tabResumen).toBeVisible({ timeout: 8_000 });
    await shot(page, '03-tab-resumen', testInfo.title);

    // Tab Historial
    await page.getByRole('tab', { name: /historial/i }).click();
    // Esperar que el panel sea visible (cualquier contenido del panel activo)
    await expect(page.getByRole('tabpanel').first()).toBeVisible({ timeout: 8_000 });
    await shot(page, '04-tab-historial', testInfo.title);

    // Tab Repuestos
    await page.getByRole('tab', { name: /repuestos/i }).click();
    await expect(page.getByRole('tabpanel').first()).toBeVisible({ timeout: 8_000 });
    await shot(page, '05-tab-repuestos', testInfo.title);

    // Volver a Resumen
    await page.getByRole('tab', { name: /resumen/i }).click();
    await expect(page.getByRole('tabpanel').first()).toBeVisible({ timeout: 8_000 });
    await shot(page, '06-tab-resumen-de-vuelta', testInfo.title);
  });

  test('abrir dialog QR y generar/regenerar codigo', async ({ page }, testInfo) => {
    const s = uniqueSuffix();
    const codigo = `EQ-E2E-${s}`;
    const nombre = `Equipo E2E ${s}`;

    await loginAs(page, 'admin');

    const detalleHref = await crearEquipoComoAdmin(page, {
      codigo,
      nombre,
      marca: 'Caterpillar',
      modelo: `D9-${s.slice(-4)}`,
      ubicacion: `Zona-QR-${s.slice(-4)}`,
    });

    // Navegar al detalle
    await page.goto(detalleHref);
    await page.waitForURL(/\/equipos\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: nombre })).toBeVisible({
      timeout: 10_000,
    });

    // Abrir el dialog QR
    const btnQr = page.getByRole('button', { name: /^qr$/i });
    await btnQr.waitFor({ state: 'visible', timeout: 8_000 });
    await btnQr.click();

    // Verificar que el dialog se abre
    await expect(
      page.getByText(/código qr del equipo/i),
    ).toBeVisible({ timeout: 8_000 });

    // Screenshot: dialog QR abierto (equipo nuevo, sin QR)
    await shot(page, '01-dialog-qr-abierto', testInfo.title);

    // Para un equipo recien creado, no tiene QR todavia → boton "Generar QR"
    const btnGenerar = page.getByRole('button', { name: /generar qr/i });
    const btnRegenerar = page.getByRole('button', { name: /^regenerar$/i });

    const tieneGenerar = await btnGenerar.isVisible({ timeout: 3_000 }).catch(() => false);
    const tieneRegenerar = await btnRegenerar.isVisible({ timeout: 1_000 }).catch(() => false);

    if (tieneGenerar) {
      // Flujo: generar por primera vez
      await btnGenerar.click();

      // Esperar a que aparezca el enlace del QR con "/q/"
      const qrCode = page.locator('code').filter({ hasText: /\/q\// });
      await expect(qrCode).toBeVisible({ timeout: 15_000 });

      const qrUrl = await qrCode.textContent();
      expect(qrUrl).toMatch(/\/q\//);

      // Screenshot: QR generado
      await shot(page, '02-qr-generado', testInfo.title);

      // Regenerar: click en Regenerar → aparece confirmacion
      const btnRegen2 = page.getByRole('button', { name: /^regenerar$/i });
      await expect(btnRegen2).toBeVisible({ timeout: 8_000 });
      await btnRegen2.click();

      const btnConfirmar = page.getByRole('button', { name: /confirmar regeneraci[oó]n/i });
      await expect(btnConfirmar).toBeVisible({ timeout: 8_000 });
      await shot(page, '03-confirmacion-regenerar', testInfo.title);

      await btnConfirmar.click();

      // El QR regenerado sigue mostrando una URL con /q/
      await expect(
        page.locator('code').filter({ hasText: /\/q\// }),
      ).toBeVisible({ timeout: 15_000 });

      const qrUrlRegen = await page.locator('code').filter({ hasText: /\/q\// }).textContent();
      expect(qrUrlRegen).toMatch(/\/q\//);

      // Screenshot: QR regenerado
      await shot(page, '04-qr-regenerado', testInfo.title);

    } else if (tieneRegenerar) {
      // El equipo ya tenia QR (poco probable para recien creado, pero posible)
      const qrCode = page.locator('code').filter({ hasText: /\/q\// });
      await expect(qrCode).toBeVisible({ timeout: 8_000 });
      const qrUrl = await qrCode.textContent();
      expect(qrUrl).toMatch(/\/q\//);
      await shot(page, '02-qr-existente', testInfo.title);

      await btnRegenerar.click();
      const btnConfirmar = page.getByRole('button', { name: /confirmar regeneraci[oó]n/i });
      await expect(btnConfirmar).toBeVisible({ timeout: 8_000 });
      await shot(page, '03-confirmacion-regenerar', testInfo.title);
      await btnConfirmar.click();

      await expect(
        page.locator('code').filter({ hasText: /\/q\// }),
      ).toBeVisible({ timeout: 15_000 });
      const qrUrlRegen = await page.locator('code').filter({ hasText: /\/q\// }).textContent();
      expect(qrUrlRegen).toMatch(/\/q\//);
      await shot(page, '04-qr-regenerado', testInfo.title);

    } else {
      await shot(page, '02-estado-qr-inesperado', testInfo.title);
      throw new Error('No se encontro boton "Generar QR" ni "Regenerar" en el dialog QR');
    }

    // Cerrar el dialog
    await page.getByRole('button', { name: /^cerrar$/i }).click();
    await expect(page.getByText(/código qr del equipo/i)).not.toBeVisible({
      timeout: 5_000,
    });
    await shot(page, '05-dialog-cerrado', testInfo.title);
  });
});

// ─────────────────────────────────────────────────────────────
// Gating: jefe_taller puede ver, NO puede crear/editar
// ─────────────────────────────────────────────────────────────

test.describe('Equipos — Jefe Taller (solo lectura)', () => {
  test('jefe_taller ve listado pero NO boton crear equipo', async ({ page }, testInfo) => {
    await loginAs(page, 'jefe_taller');
    await page.goto('/equipos');
    await page.waitForURL('**/equipos', { timeout: 15_000 });

    // Esperar que cargue (heading Equipos)
    await expect(page.getByRole('heading', { name: /^equipos$/i })).toBeVisible({
      timeout: 10_000,
    });

    // Screenshot: listado como jefe_taller
    await shot(page, '01-listado-jefe-taller', testInfo.title);

    // El boton "Agregar equipo" NO debe existir
    await expect(
      page.getByRole('button', { name: /agregar equipo/i }),
    ).not.toBeVisible({ timeout: 3_000 });

    // La pagina cargo correctamente: hay tabla o empty state
    const hayTabla = await page.locator('table').isVisible().catch(() => false);
    const hayEmptyState = await page
      .getByText(/no hay equipos registrados|sin resultados/i)
      .isVisible()
      .catch(() => false);
    const hayTarjetas = await page.locator('[class*="divide-y"]').isVisible().catch(() => false);

    expect(hayTabla || hayEmptyState || hayTarjetas).toBe(true);

    // Screenshot: confirmacion sin boton crear
    await shot(page, '02-sin-boton-crear', testInfo.title);
  });

  test('jefe_taller ve detalle de equipo sin boton editar', async ({ page }, testInfo) => {
    await loginAs(page, 'jefe_taller');
    await page.goto('/equipos');
    await page.waitForURL('**/equipos', { timeout: 15_000 });
    await page.waitForTimeout(1_500);

    // Buscar cualquier link de equipo (formato codigo: letras/guiones/numeros)
    // El listado tiene links con el codigo del equipo en la columna Codigo
    // En desktop son <a> dentro de <td>; en mobile son <a> envolviendo un <p>
    const primerLink = page
      .locator('table a[href^="/equipos/"], [class*="divide-y"] a[href^="/equipos/"]')
      .first();

    const hayEquipo = await primerLink.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hayEquipo) {
      await shot(page, '01-sin-equipos', testInfo.title);
      // Si el sandbox no tiene equipos no podemos probar el detalle
      // pero el test de listado ya verifica el gating del boton crear.
      test.skip(true, 'No hay equipos en el listado para abrir el detalle');
      return;
    }

    await shot(page, '01-listado-con-equipos', testInfo.title);
    await primerLink.click();

    await page.waitForURL(/\/equipos\/[^/]+$/, { timeout: 15_000 });

    // El detalle carga
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });

    // Screenshot: detalle como jefe_taller
    await shot(page, '02-detalle-equipo-jefe', testInfo.title);

    // Boton "Editar" (icono Pencil + texto Editar) NO debe aparecer para jefe_taller
    // (el componente lo guarda con isAdmin && <Button>Editar</Button>)
    await expect(
      page.getByRole('button', { name: /^editar$/i }),
    ).not.toBeVisible({ timeout: 3_000 });

    // Screenshot: sin boton editar
    await shot(page, '03-sin-boton-editar', testInfo.title);

    // El boton QR SI aparece para todos los roles
    await expect(
      page.getByRole('button', { name: /^qr$/i }),
    ).toBeVisible({ timeout: 5_000 });

    // Screenshot: boton QR visible
    await shot(page, '04-boton-qr-visible', testInfo.title);
  });
});
