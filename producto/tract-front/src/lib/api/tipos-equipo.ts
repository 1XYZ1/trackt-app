import { authFetch } from "@/lib/api/http";

// Catálogo de tipos de equipo (datos maestros) por tenant. Espejo del patrón de
// Marca: nombre + activo + metadata, con sub-recurso de "repuestos default" que
// se autocopian a equipos_repuestos al crear un equipo de ese tipo.
export type TipoEquipo = {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type CreateTipoEquipoPayload = {
  nombre: string;
  descripcion?: string;
  metadata?: Record<string, unknown>;
};

// Escritura solo admin. `activo: true` reactiva (no hay endpoint dedicado).
export type UpdateTipoEquipoPayload = {
  nombre?: string;
  descripcion?: string | null;
  activo?: boolean;
  metadata?: Record<string, unknown>;
};

export type TiposEquipoFilters = {
  search?: string;
  includeInactive?: boolean;
};

// Respeta @Max(100) del PaginationQueryDto del backend; pedir más devuelve 400.
const TIPOS_EQUIPO_PAGE_LIMIT = 100;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
  }
}

async function extractError(response: Response, fallback: string) {
  // Mensajes Nest: { message: string | string[], statusCode, error }.
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    // sin body json — usar fallback
  }
  return fallback;
}

type PaginatedTiposEquipo = {
  data: TipoEquipo[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

async function fetchTiposEquipoPage(
  page: number,
  filters: TiposEquipoFilters,
): Promise<PaginatedTiposEquipo> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.includeInactive) params.set("includeInactive", "true");
  params.set("page", String(page));
  params.set("limit", String(TIPOS_EQUIPO_PAGE_LIMIT));

  const response = await authFetch(
    `${API_BASE_URL}/tipos-equipo?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudieron cargar los tipos de equipo"),
    );
  }
  return (await response.json()) as PaginatedTiposEquipo;
}

// Trae todos los tipos recorriendo las páginas (catálogo, sin UI de paginación).
export async function getTiposEquipo(
  filters: TiposEquipoFilters = {},
): Promise<TipoEquipo[]> {
  assertApiBaseUrl();

  const first = await fetchTiposEquipoPage(1, filters);
  if (first.meta.totalPages <= 1) return first.data;

  const restPages = Array.from(
    { length: first.meta.totalPages - 1 },
    (_, i) => i + 2,
  );
  const rest = await Promise.all(
    restPages.map((p) => fetchTiposEquipoPage(p, filters)),
  );
  return [first.data, ...rest.map((r) => r.data)].flat();
}

export async function getTipoEquipo(id: string): Promise<TipoEquipo> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/tipos-equipo/${id}`);
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo cargar el tipo de equipo"),
    );
  }
  return (await response.json()) as TipoEquipo;
}

export async function createTipoEquipo(
  payload: CreateTipoEquipoPayload,
): Promise<TipoEquipo> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/tipos-equipo`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo crear el tipo de equipo"),
    );
  }
  return (await response.json()) as TipoEquipo;
}

export async function updateTipoEquipo(
  id: string,
  payload: UpdateTipoEquipoPayload,
): Promise<TipoEquipo> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/tipos-equipo/${id}`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo actualizar el tipo de equipo"),
    );
  }
  return (await response.json()) as TipoEquipo;
}

export async function desactivarTipoEquipo(id: string): Promise<TipoEquipo> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/tipos-equipo/${id}/desactivar`,
    { method: "PATCH" },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo desactivar el tipo de equipo"),
    );
  }
  return (await response.json()) as TipoEquipo;
}

// No hay endpoint dedicado de reactivar: se hace con PATCH activo: true.
export async function reactivarTipoEquipo(id: string): Promise<TipoEquipo> {
  return updateTipoEquipo(id, { activo: true });
}

// ============================================================
// Repuestos default del tipo de equipo (array plano, no paginado)
// ============================================================

export type TipoEquipoRepuestoDefault = {
  id: string;
  tipoEquipoId: string;
  cantidadRef: number | null;
  obligatorio: boolean;
  observacion: string | null;
  createdAt: string;
  repuesto: {
    id: string;
    codigo: string;
    nombre: string;
    unidad: string;
    activo: boolean;
    marcaId: string | null;
    stockDisponible: number;
  };
};

export type AddTipoEquipoRepuestoPayload = {
  repuestoId: string;
  cantidadRef?: number;
  obligatorio?: boolean;
  observacion?: string;
};

export async function getTipoEquipoRepuestos(
  id: string,
): Promise<TipoEquipoRepuestoDefault[]> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/tipos-equipo/${id}/repuestos`,
  );
  if (!response.ok) {
    throw new Error(
      await extractError(
        response,
        "No se pudieron cargar los repuestos del tipo de equipo",
      ),
    );
  }
  return (await response.json()) as TipoEquipoRepuestoDefault[];
}

export async function addTipoEquipoRepuesto(
  id: string,
  payload: AddTipoEquipoRepuestoPayload,
): Promise<TipoEquipoRepuestoDefault> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/tipos-equipo/${id}/repuestos`,
    {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo asociar el repuesto"),
    );
  }
  return (await response.json()) as TipoEquipoRepuestoDefault;
}

export async function removeTipoEquipoRepuesto(
  id: string,
  repuestoId: string,
): Promise<void> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/tipos-equipo/${id}/repuestos/${repuestoId}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo quitar el repuesto"),
    );
  }
}
