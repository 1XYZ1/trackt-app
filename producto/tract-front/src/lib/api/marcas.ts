import { authFetch } from "@/lib/api/http";

export type MarcaTipo = "EQUIPO" | "REPUESTO" | "AMBOS";

export type Marca = {
  id: string;
  nombre: string;
  tipo: MarcaTipo;
  activo: boolean;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type CreateMarcaPayload = {
  nombre: string;
  tipo: MarcaTipo;
  metadata?: Record<string, unknown>;
};

// Escritura solo admin. `activo: true` reactiva (no hay endpoint dedicado).
export type UpdateMarcaPayload = {
  nombre?: string;
  tipo?: MarcaTipo;
  activo?: boolean;
  metadata?: Record<string, unknown>;
};

export type MarcasFilters = {
  search?: string;
  // Filtro por ámbito: EQUIPO trae {EQUIPO, AMBOS}; REPUESTO trae {REPUESTO, AMBOS}.
  tipo?: MarcaTipo;
  includeInactive?: boolean;
};

// Respeta @Max(100) del PaginationQueryDto del backend; pedir más devuelve 400.
const MARCAS_PAGE_LIMIT = 100;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
  }
}

async function extractError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    // sin body json — usar fallback
  }
  return fallback;
}

type PaginatedMarcas = {
  data: Marca[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

async function fetchMarcasPage(
  page: number,
  filters: MarcasFilters,
): Promise<PaginatedMarcas> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.tipo) params.set("tipo", filters.tipo);
  if (filters.includeInactive) params.set("includeInactive", "true");
  params.set("page", String(page));
  params.set("limit", String(MARCAS_PAGE_LIMIT));

  const response = await authFetch(`${API_BASE_URL}/marcas?${params.toString()}`);
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudieron cargar las marcas"),
    );
  }
  return (await response.json()) as PaginatedMarcas;
}

// Trae todas las marcas recorriendo las páginas (catálogo, sin UI de paginación).
export async function getMarcas(filters: MarcasFilters = {}): Promise<Marca[]> {
  assertApiBaseUrl();

  const first = await fetchMarcasPage(1, filters);
  if (first.meta.totalPages <= 1) return first.data;

  const restPages = Array.from(
    { length: first.meta.totalPages - 1 },
    (_, i) => i + 2,
  );
  const rest = await Promise.all(restPages.map((p) => fetchMarcasPage(p, filters)));
  return [first.data, ...rest.map((r) => r.data)].flat();
}

export async function createMarca(payload: CreateMarcaPayload): Promise<Marca> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/marcas`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await extractError(response, "No se pudo crear la marca"));
  }
  return (await response.json()) as Marca;
}

export async function updateMarca(
  id: string,
  payload: UpdateMarcaPayload,
): Promise<Marca> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/marcas/${id}`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo actualizar la marca"),
    );
  }
  return (await response.json()) as Marca;
}

export async function desactivarMarca(id: string): Promise<Marca> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/marcas/${id}/desactivar`, {
    method: "PATCH",
  });
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo desactivar la marca"),
    );
  }
  return (await response.json()) as Marca;
}

// No hay endpoint dedicado de reactivar: se hace con PATCH activo: true.
export async function reactivarMarca(id: string): Promise<Marca> {
  return updateMarca(id, { activo: true });
}
