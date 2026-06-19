# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ticket-lifecycle.spec.ts >> flujo completo OT ticket PENDIENTE->ASIGNADO->EN_EJECUCION->EJECUTADO->CERRADO
- Location: e2e\ticket-lifecycle.spec.ts:40:5

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e6]:
        - complementary [ref=e7]:
          - generic [ref=e8]:
            - img "Trackt" [ref=e9]
            - heading "Trackt" [level=1] [ref=e10]
            - paragraph [ref=e11]: SaaS industrial de mantenimiento
          - img
        - generic [ref=e12]:
          - generic [ref=e13]:
            - paragraph [ref=e14]: Ingreso al sistema
            - heading "Bienvenido de nuevo" [level=2] [ref=e15]
            - paragraph [ref=e16]: Usa tus credenciales asignadas para acceder al panel de Trackt.
          - generic [ref=e17]:
            - generic [ref=e18]:
              - generic [ref=e19]: Correo electrónico
              - generic [ref=e20]:
                - img
                - textbox "Correo electrónico" [ref=e22]:
                  - /placeholder: tu@empresa.cl
                  - text: admin@trackt.demo
            - generic [ref=e23]:
              - generic [ref=e24]:
                - generic [ref=e25]: Contraseña
                - link "¿Olvidaste tu contraseña?" [ref=e26] [cursor=pointer]:
                  - /url: /forgot-password
              - generic [ref=e27]:
                - img
                - textbox "Contraseña" [ref=e29]:
                  - /placeholder: ••••••••••
                  - text: Trackt!2026
                - button "Mostrar contraseña" [ref=e30]:
                  - img [ref=e31]
            - button "Iniciar sesión Loading" [disabled]:
              - generic: Iniciar sesión
              - img
              - status "Loading"
          - generic [ref=e35]:
            - img [ref=e36]
            - text: Acceso restringido al personal autorizado.
      - paragraph [ref=e39]: Copyright 2026 Trackt. Operación minera e industrial.
  - region "Notifications alt+T"
  - alert [ref=e40]
```

# Test source

```ts
  1  | import path from 'path';
  2  | import { expect, type Page } from '@playwright/test';
  3  | import { CREDS, ROLE_HOME, type Role } from './fixtures';
  4  | 
  5  | /** Contador global de screenshots por test (reiniciado por test via shot()) */
  6  | const _shotCounters = new Map<string, number>();
  7  | 
  8  | /**
  9  |  * loginAs — hace login por UI (formulario email/password de Supabase)
  10 |  * y espera la ruta de aterrizaje correcta para el rol.
  11 |  * No usa storageState en archivo para ser parallel-safe.
  12 |  */
  13 | export async function loginAs(page: Page, role: Role): Promise<void> {
  14 |   await page.goto('/login');
  15 | 
  16 |   // Esperar que el formulario sea visible
  17 |   await page.getByLabel('Correo electrónico').waitFor({ state: 'visible' });
  18 | 
  19 |   await page.getByLabel('Correo electrónico').fill(CREDS[role].email);
  20 |   // El label "Contraseña" también aplica al botón "Mostrar contraseña" via aria-label,
  21 |   // por eso usamos el id del input directamente para ser precisos.
  22 |   await page.locator('#password').fill(CREDS[role].password);
  23 |   await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  24 | 
  25 |   // Esperar la redirección al landing del rol
  26 |   const expectedPath = ROLE_HOME[role];
> 27 |   await page.waitForURL((url) => url.pathname.startsWith(expectedPath), {
     |              ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  28 |     timeout: 15_000,
  29 |   });
  30 | 
  31 |   // Verificar que la página cargó correctamente
  32 |   await expect(page).toHaveURL(new RegExp(expectedPath));
  33 | }
  34 | 
  35 | /**
  36 |  * logout — cierra sesión mediante el botón "Cerrar sesion" del header.
  37 |  * Espera redirección a /login.
  38 |  */
  39 | export async function logout(page: Page): Promise<void> {
  40 |   const logoutBtn = page.getByRole('button', { name: /cerrar sesi[oó]n/i });
  41 |   await logoutBtn.waitFor({ state: 'visible' });
  42 |   await logoutBtn.click();
  43 |   await page.waitForURL('**/login', { timeout: 10_000 });
  44 | }
  45 | 
  46 | /**
  47 |  * shot — guarda un screenshot en e2e/evidence/<nombre-del-test>/<name>.png
  48 |  *
  49 |  * Uso:
  50 |  *   import { test } from '@playwright/test';
  51 |  *   import { shot } from './helpers';
  52 |  *
  53 |  *   test('mi test', async ({ page }, testInfo) => {
  54 |  *     await shot(page, '01-paso', testInfo.title);
  55 |  *   });
  56 |  *
  57 |  * O bien, pasar testInfo.title como tercer argumento para el nombre de carpeta.
  58 |  * Si se omite, usa 'unknown-test'.
  59 |  */
  60 | export async function shot(
  61 |   page: Page,
  62 |   name: string,
  63 |   testTitle?: string,
  64 | ): Promise<void> {
  65 |   // Sanitizar el nombre del test para usarlo como nombre de carpeta
  66 |   const rawTitle = testTitle ?? 'unknown-test';
  67 |   const testFolder = rawTitle
  68 |     .toLowerCase()
  69 |     .replace(/[^a-z0-9]+/g, '-')
  70 |     .replace(/^-+|-+$/g, '');
  71 | 
  72 |   // Sanitizar el nombre del screenshot
  73 |   const safeName = name
  74 |     .toLowerCase()
  75 |     .replace(/[^a-z0-9]+/g, '-')
  76 |     .replace(/^-+|-+$/g, '');
  77 | 
  78 |   const screenshotPath = path.join(
  79 |     // __dirname es e2e/
  80 |     __dirname,
  81 |     'evidence',
  82 |     testFolder,
  83 |     `${safeName}.png`,
  84 |   );
  85 | 
  86 |   await page.screenshot({ path: screenshotPath, fullPage: false });
  87 | }
  88 | 
```