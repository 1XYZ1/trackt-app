import type { UserRole } from "./profile";

// Ruta "home" por rol. Fuente única para el landing post-login y para el
// destino de fallback cuando un rol entra a una página que no le corresponde
// (evita bucles de redirect — p.ej. jefe_inventario no ve /dashboard).
export function defaultRouteForRole(
  role: UserRole | string | undefined,
): string {
  switch (role) {
    case "mechanic":
      return "/mis-tickets";
    case "jefe_inventario":
      return "/inventario";
    default:
      return "/dashboard"; // admin, jefe_taller
  }
}
