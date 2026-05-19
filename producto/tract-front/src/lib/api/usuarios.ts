import { authFetch } from "@/lib/api/http";

export type UsuarioRol = "admin" | "jefe_taller" | "mechanic";

export type UsuarioPublico = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: UsuarioRol;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
  }
}

/**
 * Lista usuarios del tenant. Solo accesible por admin.
 * El backend acepta `rol=mecanico` (mapea internamente a `mechanic`).
 */
export async function getUsuarios(params?: {
  rol?: "mecanico" | "admin";
}): Promise<UsuarioPublico[]> {
  assertApiBaseUrl();

  const qs = new URLSearchParams();
  if (params?.rol) qs.set("rol", params.rol);
  qs.set("limit", "100");

  const response = await authFetch(`${API_BASE_URL}/usuarios?${qs.toString()}`);

  if (!response.ok) {
    throw new Error("No se pudieron cargar los usuarios");
  }

  const result = (await response.json()) as { data: UsuarioPublico[] };
  return result.data;
}

export function getMecanicos(): Promise<UsuarioPublico[]> {
  return getUsuarios({ rol: "mecanico" });
}
