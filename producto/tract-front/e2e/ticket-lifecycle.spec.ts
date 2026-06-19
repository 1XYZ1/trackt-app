/**
 * ticket-lifecycle.spec.ts
 *
 * Flujo completo de OT/ticket con transiciones de estado:
 *   PENDIENTE -> ASIGNADO -> EN_EJECUCION -> EJECUTADO -> CERRADO
 *
 * Contexto admin:  crear equipo -> crear OT -> crear ticket -> asignar mecanico
 * Contexto mechanic: abrir ticket en /mis-tickets -> iniciar -> subir evidencia -> finalizar
 * Contexto admin:  validar (aprobar y cerrar) -> CERRADO
 */

import path from 'path';
import { test, expect, type Browser } from '@playwright/test';
import { loginAs, shot } from './helpers';
import { uniqueSuffix } from './fixtures';

// ─── Helper para esperar un badge de estado visible ───────────────────────────
async function expectEstado(page: import('@playwright/test').Page, estado: string) {
  await expect(
    page.getByText(estado, { exact: false }).first(),
  ).toBeVisible({ timeout: 15_000 });
}

// ─── Helper para navegar al detalle de un ticket en /mis-tickets/<id> ────────
async function abrirMiTicketById(page: import('@playwright/test').Page, ticketId: string) {
  await page.goto(`/mis-tickets/${ticketId}`);
  await page.waitForURL(`**/mis-tickets/${ticketId}`, { timeout: 15_000 });
  // Esperar que el detalle cargue
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
}

// ─── Fixture global de la imagen de evidencia ────────────────────────────────
const EVIDENCE_PNG = path.join(__dirname, 'fixtures', 'evidence.png');

// ─────────────────────────────────────────────────────────────────────────────
// TEST PRINCIPAL
// Timeout extendido: el flujo completo atraviesa ~7 steps con UI, 2 logins,
// subida de evidencia a Supabase Storage y multiple esperas de red.
// ─────────────────────────────────────────────────────────────────────────────
test('flujo completo OT ticket PENDIENTE->ASIGNADO->EN_EJECUCION->EJECUTADO->CERRADO', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const suffix = uniqueSuffix();
  const equipoCodigo = `EQ-E2E-${suffix}`;
  const equipoNombre = `Equipo E2E ${suffix}`;
  const otDescripcion = `OT E2E ${suffix} - mantencion preventiva`;
  const ticketTitulo = `TK E2E ${suffix} - revision hidraulica`;
  const ticketDesc = `Revisar y limpiar sistema hidraulico del equipo ${suffix}`;

  // ─────────────────────────────────────────────────────────────────────
  // FASE 1: ADMIN — Crear equipo
  // ─────────────────────────────────────────────────────────────────────
  await test.step('admin: crear equipo', async () => {
    await loginAs(page, 'admin');
    await shot(page, '01-admin-dashboard', testInfo.title);

    await page.goto('/equipos');
    await page.waitForURL('**/equipos', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /equipos/i }).first()).toBeVisible({ timeout: 10_000 });
    await shot(page, '02-equipos-lista', testInfo.title);

    // Abrir form de nuevo equipo
    await page.getByRole('button', { name: /agregar equipo/i }).click();

    // Esperar el sheet
    await expect(page.getByRole('heading', { name: /nuevo equipo/i })).toBeVisible({ timeout: 8_000 });

    await page.locator('#codigo').fill(equipoCodigo);
    await page.locator('#nombre').fill(equipoNombre);
    await page.locator('#ubicacion').fill(`Zona E2E ${suffix}`);

    await shot(page, '03-form-equipo', testInfo.title);

    await page.getByRole('button', { name: /crear equipo/i }).click();

    // Esperar que el sheet cierre y aparezca el toast de exito
    await expect(page.getByText(/equipo creado/i)).toBeVisible({ timeout: 15_000 });

    await shot(page, '04-equipo-creado', testInfo.title);

    // Verificar que el equipo aparece en la lista (puede resolver 2 elementos: link + p)
    await expect(page.getByText(equipoCodigo).first()).toBeVisible({ timeout: 15_000 });
  });

  // ─────────────────────────────────────────────────────────────────────
  // FASE 2: ADMIN — Crear OT para ese equipo
  // ─────────────────────────────────────────────────────────────────────
  let ordenId = '';

  await test.step('admin: crear OT para el equipo', async () => {
    await page.goto('/ordenes');
    await page.waitForURL('**/ordenes', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /órdenes de trabajo/i }).first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /nueva ot/i }).click();
    await expect(page.getByRole('heading', { name: /nueva ot/i })).toBeVisible({ timeout: 8_000 });

    // Seleccionar equipo via el EquipoSelect (combobox)
    // EquipoSelect usa un Select de shadcn/ui; buscar el trigger dentro del sheet
    const equipoSelectTrigger = page.locator('[id="mecanico-select"]').or(
      page.getByRole('combobox').first()
    );

    // El EquipoSelect no tiene id, usar el button con placeholder "Seleccionar equipo"
    await page.getByText('Seleccionar equipo').click();
    // Esperar que aparezca la lista de opciones
    await page.waitForTimeout(500);
    // Buscar el equipo por codigo en el listbox
    const equipoOption = page.getByRole('option', { name: new RegExp(equipoCodigo, 'i') });
    if (await equipoOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await equipoOption.click();
    } else {
      // Puede que el listbox sea un select nativo o un combobox con filtro
      // Intentar con getByText dentro del popover
      await page.getByText(equipoCodigo, { exact: false }).first().click();
    }

    // Descripcion de la OT
    await page.locator('#descripcion').fill(otDescripcion);

    // Prioridad: seleccionar "Media" (default)
    // Ya esta seleccionada por defecto, no cambiar

    await shot(page, '05-form-nueva-ot', testInfo.title);

    await page.getByRole('button', { name: /crear ot/i }).click();

    // La app navega a /ordenes/<id> tras crear
    await page.waitForURL('**/ordenes/**', { timeout: 20_000 });
    ordenId = page.url().split('/ordenes/')[1].split('?')[0].split('/')[0];

    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 10_000 });
    await shot(page, '06-ot-creada', testInfo.title);

    // Verificar que la descripcion aparece en el detalle
    await expect(page.getByText(otDescripcion, { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────────────────────────────
  // FASE 3: ADMIN — Crear ticket dentro de la OT
  // ─────────────────────────────────────────────────────────────────────
  let ticketId = '';

  await test.step('admin: crear ticket en la OT', async () => {
    // Ya estamos en /ordenes/<id>; abrir el sheet de crear ticket
    await page.getByRole('button', { name: /crear ticket/i }).first().click();
    await expect(page.getByRole('heading', { name: /crear ticket desde ot/i })).toBeVisible({ timeout: 8_000 });

    await page.locator('#titulo').fill(ticketTitulo);
    await page.locator('#descripcion').fill(ticketDesc);

    // Prioridad: seleccionar "Alta"
    await page.getByText('Alta', { exact: false }).first().click();

    await shot(page, '07-form-crear-ticket', testInfo.title);

    await page.getByRole('button', { name: /crear ticket/i }).click();

    // La app navega a /tickets/<id> tras crear
    await page.waitForURL('**/tickets/**', { timeout: 20_000 });
    ticketId = page.url().split('/tickets/')[1].split('?')[0].split('/')[0];

    await expect(page.getByText(ticketTitulo, { exact: false })).toBeVisible({ timeout: 10_000 });

    // Verificar estado PENDIENTE
    await expectEstado(page, 'PENDIENTE');
    await shot(page, '08-ticket-PENDIENTE', testInfo.title);
  });

  // ─────────────────────────────────────────────────────────────────────
  // FASE 4: ADMIN — Asignar mecanico
  // ─────────────────────────────────────────────────────────────────────
  await test.step('admin: asignar mecanico', async () => {
    // Boton "Asignar mecanico" visible en estado PENDIENTE
    await page.getByRole('button', { name: /asignar mec[aá]nico/i }).click();

    // Esperar el dialog y que carguen los mecanicos (SelectTrigger #mecanico-select)
    const mecanicoTrigger = page.locator('#mecanico-select');
    await expect(mecanicoTrigger).toBeVisible({ timeout: 10_000 });

    // Abrir el listbox de mecanicos y seleccionar mecanico1@trackt.demo
    await mecanicoTrigger.click();

    // Esperar que el listbox/popover se abra: los items tienen role=option
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible({ timeout: 8_000 });

    // Seleccionar la opcion que contiene "mecanico1@trackt.demo"
    // Usar locator('[role=option]').filter para evitar strict mode
    const mecOption = page.locator('[role="option"]').filter({ hasText: 'mecanico1@trackt.demo' }).first();
    await expect(mecOption).toBeVisible({ timeout: 5_000 });
    await mecOption.click();

    // Esperar que el listbox se cierre (la seleccion fue registrada)
    await expect(listbox).not.toBeVisible({ timeout: 5_000 });

    // Dar tiempo al estado React para actualizarse antes de hacer click en Asignar
    await page.waitForTimeout(500);

    await shot(page, '09-form-asignar-mecanico', testInfo.title);

    // Click en el boton "Asignar" del footer del dialog
    // Usar el selector especifico por texto del boton (no regex de nombre de mecánico)
    const asignarBtn = page.getByRole('dialog').getByRole('button', { name: /asignar/i }).last();
    await expect(asignarBtn).toBeEnabled({ timeout: 3_000 });
    await asignarBtn.click();

    // Esperar que el DIALOG se cierre — confirma que la mutacion tuvo exito
    // (si mecanicoId estaba vacio, el dialog permaneceria abierto con error)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 15_000 });

    // Ahora esperar que el badge de estado en la pagina sea ASIGNADO
    // Usar el StatusBadge especificamente (badge dentro del h1 area)
    await expect(
      page.locator('[class*="badge"], [class*="Badge"]').filter({ hasText: /^ASIGNADO$/i }).first()
    ).toBeVisible({ timeout: 15_000 });

    await shot(page, '10-ticket-ASIGNADO', testInfo.title);
  });

  // ─────────────────────────────────────────────────────────────────────
  // FASE 5: MECANICO — Iniciar ejecucion (nuevo contexto de browser)
  // ─────────────────────────────────────────────────────────────────────
  const mechContext = await browser.newContext();
  const mechPage = await mechContext.newPage();

  await test.step('mecanico: iniciar ejecucion del ticket', async () => {
    await loginAs(mechPage, 'mechanic');
    await shot(mechPage, '11-mechanic-mis-tickets', testInfo.title);

    // Esperar que la lista de mis-tickets este cargada
    await mechPage.waitForURL('**/mis-tickets', { timeout: 15_000 });
    await expect(mechPage.getByRole('heading', { name: /mis tickets/i })).toBeVisible({ timeout: 10_000 });

    // Esperar que el ticket ASIGNADO aparezca en la lista (puede tardar un poco)
    // Buscar por el sufijo unico que es mas corto y sin caracter especial '-'
    await expect(mechPage.getByText(suffix, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await shot(mechPage, '12-lista-ticket-asignado', testInfo.title);

    // Clic en "Iniciar trabajo" (boton en la tarjeta cuando estado=ASIGNADO)
    const iniciarBtn = mechPage.getByRole('button', { name: /iniciar trabajo/i }).first();
    await expect(iniciarBtn).toBeVisible({ timeout: 10_000 });
    await shot(mechPage, '13-antes-iniciar', testInfo.title);
    await iniciarBtn.click();

    // Esperar toast de exito
    await expect(mechPage.getByText(/trabajo iniciado/i)).toBeVisible({ timeout: 15_000 });
    await shot(mechPage, '14-EN_EJECUCION-confirmado', testInfo.title);
  });

  // ─────────────────────────────────────────────────────────────────────
  // FASE 6: MECANICO — Subir evidencia y finalizar
  // ─────────────────────────────────────────────────────────────────────
  await test.step('mecanico: subir evidencia y finalizar', async () => {
    // Ir directamente al detalle del ticket por ID (mechanic puede ver sus tickets)
    await abrirMiTicketById(mechPage, ticketId);
    await shot(mechPage, '15-mi-ticket-EN_EJECUCION', testInfo.title);

    await expectEstado(mechPage, 'EN_EJECUCION');

    // El input[type=file] esta oculto (hidden), usar setInputFiles directamente
    const fileInput = mechPage.locator('input[type="file"]');
    await fileInput.setInputFiles(EVIDENCE_PNG);

    // Esperar que la foto se suba (toast "Foto subida")
    await expect(mechPage.getByText(/foto subida/i)).toBeVisible({ timeout: 30_000 });
    await shot(mechPage, '16-evidencia-subida', testInfo.title);

    // Esperar que la evidencia aparezca en la grid (el contador debe ser >= 1)
    // El boton "Finalizar trabajo" debe estar habilitado ahora
    const finalizarBtn = mechPage.getByRole('button', { name: /finalizar trabajo/i });
    await expect(finalizarBtn).toBeEnabled({ timeout: 10_000 });
    await shot(mechPage, '17-listo-para-finalizar', testInfo.title);

    await finalizarBtn.click();

    // Aparece el dialog de finalizar con el textarea de observacion
    await expect(mechPage.getByRole('dialog')).toBeVisible({ timeout: 8_000 });
    const observacionTextarea = mechPage.getByPlaceholder(/ej: se reemplaz[oó]/i);
    await observacionTextarea.fill(`Trabajo finalizado en corrida E2E ${suffix}`);

    await shot(mechPage, '18-dialog-finalizar', testInfo.title);

    // Click en boton "Finalizar" dentro del dialog
    await mechPage.getByRole('dialog').getByRole('button', { name: /finalizar/i }).last().click();

    // Esperar toast de exito
    await expect(mechPage.getByText(/trabajo finalizado/i)).toBeVisible({ timeout: 15_000 });
    await shot(mechPage, '19-EJECUTADO-confirmado', testInfo.title);
  });

  await mechContext.close();

  // ─────────────────────────────────────────────────────────────────────
  // FASE 7: ADMIN — Validar/aprobar y cerrar el ticket
  // ─────────────────────────────────────────────────────────────────────
  await test.step('admin: validar y cerrar ticket', async () => {
    // Navegar al ticket con el contexto admin original
    await page.goto(`/tickets/${ticketId}`);
    await page.waitForURL(`**/tickets/${ticketId}`, { timeout: 15_000 });

    // Esperar que el ticket cargue con estado EJECUTADO
    await expect(page.getByText(ticketTitulo, { exact: false })).toBeVisible({ timeout: 15_000 });
    await expectEstado(page, 'EJECUTADO');
    await shot(page, '20-ticket-EJECUTADO', testInfo.title);

    // Click en "Aprobar y cerrar"
    await page.getByRole('button', { name: /aprobar y cerrar/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 8_000 });

    // Agregar observacion opcional
    const validarTextarea = page.getByPlaceholder(/observaci[oó]n opcional/i);
    await validarTextarea.fill(`Aprobado en corrida E2E ${suffix}`);

    await shot(page, '21-dialog-aprobar', testInfo.title);

    // Confirmar
    await page.getByRole('dialog').getByRole('button', { name: /aprobar y cerrar/i }).click();

    // Esperar toast de exito
    await expect(page.getByText(/ticket validado y cerrado/i)).toBeVisible({ timeout: 15_000 });

    // Esperar que el badge cambie a CERRADO
    await expectEstado(page, 'CERRADO');
    await shot(page, '22-ticket-CERRADO', testInfo.title);
  });
});
