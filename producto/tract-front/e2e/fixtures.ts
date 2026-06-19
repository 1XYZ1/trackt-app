/** Credenciales por rol. Pueden sobreescribirse con variables de entorno. */
export const CREDS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin@trackt.demo',
    password: process.env.E2E_PASSWORD ?? 'Trackt!2026',
  },
  jefe_taller: {
    email: process.env.E2E_JEFE_EMAIL ?? 'jefe@trackt.demo',
    password: process.env.E2E_PASSWORD ?? 'Trackt!2026',
  },
  mechanic: {
    email: process.env.E2E_MECHANIC_EMAIL ?? 'mecanico1@trackt.demo',
    password: process.env.E2E_PASSWORD ?? 'Trackt!2026',
  },
  jefe_inventario: {
    email: process.env.E2E_INVENTARIO_EMAIL ?? 'inventario1@trackt.demo',
    password: process.env.E2E_PASSWORD ?? 'Trackt!2026',
  },
} as const;

export type Role = keyof typeof CREDS;

/** Ruta de aterrizaje esperada tras login exitoso por rol */
export const ROLE_HOME: Record<Role, string> = {
  admin: '/dashboard',
  jefe_taller: '/dashboard',
  mechanic: '/mis-tickets',
  jefe_inventario: '/inventario',
};

/** Sufijo único por corrida para nombrar entidades de prueba sin colisiones */
export function uniqueSuffix(): string {
  return String(Date.now());
}

/** URL base de la app desplegada */
export const BASE = process.env.E2E_BASE_URL ?? 'https://trackt-front.vercel.app';
