import { authFetch } from "@/lib/api/http";

export type Equipo = {
  id: string;
  codigo: string;
  nombre: string;
  // Nullable en BD: el backend devuelve null si el campo se limpió.
  marca: string | null;
  modelo: string | null;
  ubicacion: string | null;
  activo?: boolean;
};

// Límite de página del listado (sin UI de paginación todavía). Se expone para
// que la UI pueda avisar cuando la lista se trunca.
export const EQUIPOS_PAGE_LIMIT = 200;

export type CreateEquipoPayload = {
  codigo: string;
  nombre: string;
  marca?: string;
  modelo?: string;
  ubicacion?: string;
};

// Update permite null en campos opcionales para limpiarlos en BD.
export type UpdateEquipoPayload = {
  codigo?: string;
  nombre?: string;
  marca?: string | null;
  modelo?: string | null;
  ubicacion?: string | null;
};

export type EquiposFilters = {
  includeInactive?: boolean;
  search?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
  }
}

async function extractError(response: Response, fallback: string) {
  // Mensajes Nest: { message: string | string[], statusCode, error }.
  try {
    const body = (await response.json()) as {
      message?: string | string[];
    };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    // sin body json — usar fallback
  }
  return fallback;
}

export async function getEquipos(
  filters: EquiposFilters = {},
): Promise<Equipo[]> {
  assertApiBaseUrl();

  const params = new URLSearchParams();
  if (filters.includeInactive) {
    params.set("includeInactive", "true");
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  // Sin UI de paginación todavía: traemos hasta EQUIPOS_PAGE_LIMIT en una página.
  params.set("limit", String(EQUIPOS_PAGE_LIMIT));

  const url = `${API_BASE_URL}/equipos${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await authFetch(url);

  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudieron cargar los equipos"),
    );
  }

  const result = (await response.json()) as { data: Equipo[] };
  return result.data;
}

export async function reactivarEquipo(id: string): Promise<Equipo> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/equipos/${id}/reactivar`, {
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo reactivar el equipo"),
    );
  }

  return (await response.json()) as Equipo;
}

export async function createEquipo(payload: CreateEquipoPayload): Promise<Equipo> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/equipos`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await extractError(response, "No se pudo crear el equipo"));
  }

  return (await response.json()) as Equipo;
}

export async function updateEquipo(
  id: string,
  payload: UpdateEquipoPayload,
): Promise<Equipo> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/equipos/${id}`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo actualizar el equipo"),
    );
  }

  return (await response.json()) as Equipo;
}

export async function desactivarEquipo(id: string): Promise<Equipo> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/equipos/${id}/desactivar`, {
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo desactivar el equipo"),
    );
  }

  return (await response.json()) as Equipo;
}
