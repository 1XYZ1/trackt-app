# Plan de testing E2E con Playwright — Front Trackt

> **Objetivo:** suite end-to-end que pruebe **auth**, **flujos básicos/navegación por rol** y los **CRUD** de cada dominio, corriendo el front (`producto/tract-front`, :3000) contra la API real (`producto/trackt-api`, :3001) + Supabase, con datos de `db:seed`.
>
> Roles: `admin`, `jefe_taller`, `mechanic`. Credenciales demo (tras `npm run db:seed`): `admin@trackt.demo` y `mecanico1..4@trackt.demo`, password `Trackt!2026`.
>
> Cubre además **regresión de los 4 bugs** de `revision-bugs-endpoints.md` (que rompen carga de datos).

---

## 0. Alcance

| Suite | Qué prueba |
|---|---|
| `auth` | login OK/fallido por rol, logout, protección de rutas, persistencia de sesión, refresh 401 |
| `navegacion` (smoke + RBAC) | cada página carga con datos; sidebar y acceso según rol |
| `equipos` | CRUD + ficha + QR + estados operativos + asociaciones |
| `marcas` | ABM (solo admin escribe) + `MarcaSelect` |
| `plantillas` | CRUD + items + checklist + asociación a equipo |
| `programaciones` | calendario + CRUD + generar OT |
| `inventario` | repuestos (CRUD + campos extendidos) + movimientos + reservas (ciclo) |
| `ordenes-tickets` | crear OT → ticket → máquina de estados completa |
| `reportes` | ver JSON + descargar CSV + PDF de OT |
| `regresion-data-loading` | asserts específicos de BUG-1..4 |

> Las suites de features nuevas (marcas, plantillas, programaciones, reportes, ficha de equipo) se activan a medida que se implementan las fases del `plan-front-fases-1-6.md`. Empezar por `auth`, `navegacion`, `inventario`, `ordenes-tickets` y `regresion-data-loading` (ya implementables hoy).

---

## 1. Setup

### 1.1 Instalación
```bash
cd producto/tract-front
npm i -D @playwright/test
npx playwright install --with-deps chromium
```

### 1.2 `playwright.config.ts`
```ts
import { defineConfig, devices } from "@playwright/test";

const FRONT = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["html"], ["github"]] : "list",
  use: {
    baseURL: FRONT,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    // 1) Setup: hace login de cada rol y guarda storageState
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    // 2) Proyectos por rol (dependen del setup)
    { name: "admin",   use: { ...devices["Desktop Chrome"], storageState: ".auth/admin.json" },   dependencies: ["setup"] },
    { name: "jefe",    use: { ...devices["Desktop Chrome"], storageState: ".auth/jefe.json" },    dependencies: ["setup"] },
    { name: "mecanico",use: { ...devices["Desktop Chrome"], storageState: ".auth/mecanico.json" },dependencies: ["setup"] },
    // 3) Auth sin sesión (login/logout/redirect) — sin storageState
    { name: "anon", testMatch: /auth\/.*\.spec\.ts/, use: { ...devices["Desktop Chrome"], storageState: { cookies: [], origins: [] } } },
  ],
  // Levanta el front; la API debe estar corriendo aparte (o añadir un 2º webServer).
  webServer: [
    {
      command: "npm run dev",
      url: FRONT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    // Opcional: levantar también la API
    // { command: "npm --prefix ../trackt-api run start:dev", url: "http://localhost:3001/health", reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
});
```

### 1.3 Estructura
```
producto/tract-front/e2e/
  auth.setup.ts                 # login por rol → .auth/*.json
  fixtures.ts                   # fixtures + helpers (codigo único, etc.)
  auth/
    login.spec.ts
    logout.spec.ts
    proteccion-rutas.spec.ts
  navegacion/
    smoke.spec.ts
    rbac.spec.ts
  equipos/equipos-crud.spec.ts
  marcas/marcas-crud.spec.ts
  plantillas/plantillas-crud.spec.ts
  programaciones/programaciones.spec.ts
  inventario/repuestos-crud.spec.ts
  inventario/reservas-flujo.spec.ts
  ordenes-tickets/ticket-lifecycle.spec.ts
  reportes/reportes.spec.ts
  regresion/data-loading.spec.ts
```

### 1.4 Datos de prueba (seed + aislamiento)
- **Pre-requisito:** API + Supabase corriendo y `npm run db:seed` ejecutado (tenant demo + admin + 4 mecánicos + datos). Idealmente un **tenant de test dedicado** para no ensuciar demo.
- **Aislamiento:** los CRUD crean entidades con **código único por corrida** (`codigo` de equipo/repuesto es único y se compara TRIM+UPPERCASE → 409 si se repite). Usar un sufijo de timestamp:
  ```ts
  export const uniq = (p: string) => `${p}-${Date.now().toString(36).toUpperCase()}`;
  ```
- **Limpieza:** preferir soft-delete (desactivar) al final de cada test, o un `afterAll` que llame a la API con token admin. Evitar tests que dependan del orden.

### 1.5 `.env` para E2E (no commitear secretos)
```
E2E_BASE_URL=http://localhost:3000
E2E_ADMIN_EMAIL=admin@trackt.demo
E2E_MECANICO_EMAIL=mecanico1@trackt.demo
E2E_PASSWORD=Trackt!2026
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 1.6 `auth.setup.ts` (login por rol → storageState)
```ts
import { test as setup, expect } from "@playwright/test";

const PASSWORD = process.env.E2E_PASSWORD ?? "Trackt!2026";

async function login(page, email: string, file: string) {
  await page.goto("/login");
  await page.getByLabel(/correo|email/i).fill(email);
  await page.getByLabel(/contraseña|password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /iniciar sesión|ingresar|entrar/i }).click();
  await page.waitForURL(/\/(dashboard|mis-tickets)/);     // admin/jefe → dashboard; mecánico → mis-tickets
  await page.context().storageState({ path: file });
}

setup("auth admin",    async ({ page }) => login(page, process.env.E2E_ADMIN_EMAIL ?? "admin@trackt.demo", ".auth/admin.json"));
setup("auth jefe",     async ({ page }) => login(page, process.env.E2E_JEFE_EMAIL ?? "jefe@trackt.demo", ".auth/jefe.json"));
setup("auth mecanico", async ({ page }) => login(page, process.env.E2E_MECANICO_EMAIL ?? "mecanico1@trackt.demo", ".auth/mecanico.json"));
```
> Ajustar los **selectores** (`getByLabel`/`getByRole`) al DOM real del login. Recomendado añadir `data-testid` estables a inputs/botones críticos (`data-testid="login-email"`, etc.) para no acoplar tests a textos.
> Si no existe usuario con rol `jefe_taller` en el seed, omitir ese proyecto o crearlo en el seed.

---

## 2. Suite `auth`

`auth/login.spec.ts`:
- **login OK admin** → redirige a `/dashboard`, muestra nombre/menú admin.
- **login OK mecánico** → redirige a `/mis-tickets` (o landing del rol).
- **login fallido** (password incorrecta) → muestra error, permanece en `/login`, no setea sesión.
- **campos requeridos** → validación de form (email vacío / inválido).

`auth/logout.spec.ts`:
- desde sesión activa, logout → redirige a `/login`; volver a una ruta privada (`/equipos`) reenvía a `/login`.

`auth/proteccion-rutas.spec.ts` (proyecto `anon`, sin sesión):
- `GET /dashboard`, `/equipos`, `/inventario`, `/tickets` sin sesión → redirige a `/login` (`proxy.ts`).
- estando logueado, visitar `/login` o `/` → redirige a `/dashboard`.
- **persistencia:** recargar una ruta privada mantiene la sesión (no reenvía a login).

> (Opcional avanzado) **refresh 401:** interceptar/forzar token expirado y verificar que `authFetch` refresca y reintenta una vez (difícil de simular en E2E; cubrir mejor en unit del wrapper `http.ts`).

---

## 3. Suite `navegacion` (smoke + RBAC)

`navegacion/smoke.spec.ts` (proyecto `admin`): visitar cada ruta y assert "carga con datos, sin error":
```ts
const RUTAS = ["/dashboard","/equipos","/ordenes","/tickets","/inventario","/inventario/movimientos","/inventario/reservas-pendientes","/taller/carga","/usuarios","/mantenciones","/configuracion/perfil"];
for (const ruta of RUTAS) {
  test(`carga ${ruta}`, async ({ page }) => {
    const errores: string[] = [];
    page.on("response", r => { if (r.url().includes(":3001") && r.status() >= 400) errores.push(`${r.status()} ${r.url()}`); });
    await page.goto(ruta);
    await expect(page.getByText(/error al cargar|no se pudieron cargar/i)).toHaveCount(0);
    expect(errores, `requests API fallidos en ${ruta}`).toEqual([]);
  });
}
```
> Este smoke **atrapa BUG-1/2/4** (las llamadas con `limit=200` devuelven 400 y el texto de error aparece).

`navegacion/rbac.spec.ts`:
- **mecánico** no ve entradas admin en el sidebar (Usuarios, Inventario completo, etc.) y al forzar `/usuarios` no obtiene la vista admin.
- **admin** ve Usuarios, Administración, etc.
- Verificar el landing por rol (mecánico → Mis tickets).

---

## 4. Suites CRUD por dominio

> Patrón común: **crear → ver en lista → editar → desactivar (→ reactivar)**, con `codigo`/nombre únicos por corrida. Asserts sobre toasts/filas de tabla. Preferir `getByRole`/`getByText` y `data-testid` en tablas y forms.

### 4.1 `equipos/equipos-crud.spec.ts` (admin)
- crear equipo (`codigo=uniq("EQ")`, nombre, `MarcaSelect`, `estadoOperativo`) → aparece en la lista.
- click en la fila → abre **ficha** `/equipos/[id]`; tab Resumen muestra estadísticas y alertas.
- editar (cambiar estado operativo / ubicación) → persiste.
- generar **QR** → modal muestra el código; (opcional) resolver `/equipos/qr/:token`.
- desactivar → sale de la lista (salvo "incluir inactivos") → reactivar.
- *(jefe/mecánico)*: la lista carga pero **no** ven acciones de escritura.

### 4.2 `marcas/marcas-crud.spec.ts`
- **admin:** crear marca (`tipo=EQUIPO`), editar, desactivar, reactivar (`PATCH activo:true`); dup nombre+tipo → error 409 legible.
- **mecánico/jefe:** la lista carga (lectura) pero sin botones de escritura.
- `MarcaSelect` en el form de equipo lista la marca creada (filtra por `tipo`: EQUIPO trae también AMBOS).

### 4.3 `plantillas/plantillas-crud.spec.ts` (admin/jefe)
- crear plantilla → editar → agregar **item** (selector repuesto + cantidad>0 + obligatorio) → editar item → eliminar item.
- editar **checklist** (`metadata.checklist`): agregar pasos; validar límite (rechazo >100 pasos / >500 chars sin romper).
- asociar plantilla a un equipo (tab "Plantillas aplicables") → desasociar.

### 4.4 `programaciones/programaciones.spec.ts` (admin/jefe)
- crear programación (`EquipoSelect`, plantilla opcional, `fechaProgramada` futura, responsable desde usuarios, prioridad) → aparece en lista y en **calendario** (rango que la contenga).
- editar solo si `PROGRAMADA`; intentar editar una `GENERADA` → 409 manejado.
- cancelar → estado `CANCELADA`.
- **generar OT** (modal): modo `AUTOMATICA` con stock suficiente → crea OT+ticket(+reserva), programación pasa a `GENERADA`, redirige a `ordenes/[id]`.
- generar OT con stock insuficiente (AUTOMATICA) → muestra `faltantes[]`.
- *(mecánico)*: si producto lo habilita, generar OT deja reserva `SOLICITADA`.

### 4.5 `inventario/repuestos-crud.spec.ts` (admin)
- crear repuesto con **campos extendidos** (`MarcaSelect tipo=REPUESTO`, `codigoFabricante`, `ubicacionBodega`, `proveedor`) → la **ficha** los muestra (regresión BUG-3).
- editar; entrada de stock; ajuste (con observación obligatoria) → `stockActual` cambia y aparece movimiento.
- desactivar bloqueado si `stockReservado>0` (409 legible).
- lista de repuestos **carga** (regresión BUG-2).

### 4.6 `inventario/reservas-flujo.spec.ts`
- desde un ticket, crear reserva (items) → estado `RESERVADA` (admin/jefe) o `SOLICITADA` (mecánico con `solicitar`).
- **aprobar** (SOLICITADA→RESERVADA), **consumir** (→CONSUMIDA, descuenta stock), **liberar** (→LIBERADA, repone).
- stock insuficiente → 409 estructurado `{faltantes}` mostrado.

### 4.7 `ordenes-tickets/ticket-lifecycle.spec.ts` (máquina de estados)
1. **admin** crea OT (`EquipoSelect`, descripción, prioridad) → OT `PENDIENTE`.
2. crear primer **ticket** desde la OT → ticket `PENDIENTE`, OT pasa a `EN_PROCESO`.
3. **admin/jefe** asigna ticket a `mecanico1` → `ASIGNADO`.
4. **mecánico** (proyecto `mecanico`) inicia → `EN_EJECUCION`; finaliza → `EJECUTADO`.
5. **admin** valida (`aprobado=true`) → ticket avanza; cerrar → `CERRADO`; al cerrar el último ticket, OT → `CERRADA`.
6. (rama) reasignar con motivo (obligatorio si `EN_EJECUCION`); validar con `aprobado=false`.
- assert del **timeline** del ticket en cada transición.
- assert de **guards**: una acción fuera de estado responde 409 (ESTADO_CAMBIO_CONCURRENTE) y la UI no rompe.
- **lista de OT** muestra el total correcto (regresión BUG-4: crear >10 OTs y verificar conteo del summary).

### 4.8 `reportes/reportes.spec.ts` (admin/jefe)
- cada reporte (equipos/ordenes/tickets/inventario/mantenimientos): "Ver" muestra tabla con filas.
- **Descargar CSV**: validar la descarga (no `.json()`):
  ```ts
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /descargar csv/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
  ```
- **PDF de OT**: botón en `ordenes/[id]` dispara descarga/pestaña con `application/pdf`.
- *(mecánico)*: `/reportes` no accesible (solo admin/jefe).

---

## 5. Suite `regresion/data-loading.spec.ts`

Asserts directos contra los 4 bugs (sirven de red de seguridad hasta que F0 se mergee y después):
- **BUG-1:** `/equipos` no muestra "Error al cargar"; no hay request a `:3001/equipos` con status 400. Abrir un form que use `EquipoSelect` y confirmar que lista equipos.
- **BUG-2:** `/inventario` carga la tabla de repuestos; `NuevaReservaDialog` lista repuestos.
- **BUG-4:** sembrar/crear >10 OTs; el contador "Total OT" del summary == total real (no 10).
- **BUG-3:** ficha de repuesto muestra Marca/Código fabricante/Ubicación/Proveedor cuando existen.
```ts
test("BUG-1: equipos carga sin 400", async ({ page }) => {
  const bad: number[] = [];
  page.on("response", r => { if (/\/equipos(\?|$)/.test(r.url()) && r.url().includes(":3001")) bad.push(r.status()); });
  await page.goto("/equipos");
  await expect(page.getByText(/error al cargar equipos/i)).toHaveCount(0);
  expect(bad.every(s => s < 400)).toBeTruthy();
});
```

---

## 6. CI (GitHub Actions, esquema)
```yaml
# .github/workflows/e2e.yml
name: e2e
on: { pull_request: { paths: ["producto/tract-front/**","producto/trackt-api/**"] } }
jobs:
  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      # Levantar API + Supabase (service containers o supabase CLI) y seed:
      #   - postgres service / supabase start
      #   - npm --prefix producto/trackt-api ci && run build && run db:seed && start:dev (background)
      - run: npm --prefix producto/tract-front ci
      - run: npx --prefix producto/tract-front playwright install --with-deps chromium
      - run: npm --prefix producto/tract-front exec playwright test
        env:
          E2E_BASE_URL: http://localhost:3000
          E2E_PASSWORD: ${{ secrets.E2E_PASSWORD }}
          NEXT_PUBLIC_API_URL: http://localhost:3001
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with: { name: playwright-report, path: producto/tract-front/playwright-report }
```
> El reto principal de CI es **tener API+DB+seed** reproducibles. Opciones: Supabase local (CLI) + `db:seed`, o un tenant de staging dedicado. Mantener `Trackt!2026`/emails demo solo en entornos no productivos.

---

## 7. Convenciones y buenas prácticas
- **Selectores estables:** preferir `getByRole`/`getByLabel`; añadir `data-testid` a tablas, filas, badges de estado y botones de acción. Evitar selectores por clases de Tailwind.
- **Sin sleeps:** usar auto-waiting de Playwright (`expect(...).toBeVisible()`, `waitForURL`).
- **Aislamiento:** códigos únicos por corrida; limpiar lo creado (desactivar) en `afterAll`.
- **Por rol:** correr cada spec en el proyecto del rol correcto (`test.describe.configure` o ubicación en carpeta + `--project`). Las acciones de escritura van en `admin`/`jefe`; la ejecución de tickets en `mecanico`.
- **Network asserts:** escuchar `page.on("response")` para `:3001` y fallar ante 4xx/5xx inesperados — barato y atrapa desalineaciones de contrato.
- **Orden de adopción:** primero `auth` + `navegacion` + `regresion` + `inventario` + `ordenes-tickets`; el resto conforme avanzan las fases del `plan-front-fases-1-6.md`.
