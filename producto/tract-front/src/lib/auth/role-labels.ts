import type { UserRole } from "./profile";

// Etiquetas legibles de roles. Fuente única para badges, selectores y vistas.
// (import type → no arrastra el 'server-only' de profile.ts a componentes cliente.)
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  jefe_taller: "Jefe de taller",
  jefe_inventario: "Jefe de inventario",
  mechanic: "Mecánico",
};

export function roleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}
