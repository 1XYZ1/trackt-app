import { authFetch } from "@/lib/api/http";

export type Plantilla = {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipoEquipo: string | null;
  frecuencia: string | null;
  activo: boolean;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type PlantillaListItem = Plantilla & { itemsCount: number };

export type PlantillaItem = {
  id: string;
  plantillaId: string;
  cantidad: number;
  obligatorio: boolean;
  observacion: string | null;
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

export type PlantillaDetalle = Plantilla & { items: PlantillaItem[] };

export type PlantillasFilters = {
  search?: string;
  tipoEquipo?: string;
  includeInactive?: boolean;
};

// checklist viaja dentro de metadata.checklist (string[]).
export type CreatePlantillaPayload = {
  nombre: string;
  descripcion?: string;
  tipoEquipo?: string;
  frecuencia?: string;
  checklist?: string[];
};

export type UpdatePlantillaPayload = {
  nombre?: string;
  descripcion?: string | null;
  tipoEquipo?: string | null;
  frecuencia?: string | null;
  activo?: boolean;
  checklist?: string[];
};

export type AddPlantillaItemPayload = {
  repuestoId: string;
  cantidad: number;
  obligatorio?: boolean;
  observacion?: string;
};

export type UpdatePlantillaItemPayload = {
  cantidad?: number;
  obligatorio?: boolean;
  observacion?: string | null;
};

const MAX_PAGE_LIMIT = 100;
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
    // sin body json
  }
  return fallback;
}

// Lee el checklist de una plantilla desde metadata.checklist de forma segura.
export function getChecklist(metadata: unknown): string[] {
  if (metadata && typeof metadata === "object" && "checklist" in metadata) {
    const value = (metadata as { checklist?: unknown }).checklist;
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === "string");
    }
  }
  return [];
}

type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

async function fetchPlantillasPage(
  page: number,
  filters: PlantillasFilters,
): Promise<Paginated<PlantillaListItem>> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.tipoEquipo) params.set("tipoEquipo", filters.tipoEquipo);
  if (filters.includeInactive) params.set("includeInactive", "true");
  params.set("page", String(page));
  params.set("limit", String(MAX_PAGE_LIMIT));

  const response = await authFetch(
    `${API_BASE_URL}/plantillas-mantenimiento?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudieron cargar las plantillas"),
    );
  }
  return (await response.json()) as Paginated<PlantillaListItem>;
}

export async function getPlantillas(
  filters: PlantillasFilters = {},
): Promise<PlantillaListItem[]> {
  assertApiBaseUrl();

  const first = await fetchPlantillasPage(1, filters);
  if (first.meta.totalPages <= 1) return first.data;

  const restPages = Array.from(
    { length: first.meta.totalPages - 1 },
    (_, i) => i + 2,
  );
  const rest = await Promise.all(
    restPages.map((p) => fetchPlantillasPage(p, filters)),
  );
  return [first.data, ...rest.map((r) => r.data)].flat();
}

export async function getPlantilla(id: string): Promise<PlantillaDetalle> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/plantillas-mantenimiento/${id}`,
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo cargar la plantilla"),
    );
  }
  return (await response.json()) as PlantillaDetalle;
}

function buildPlantillaBody(
  payload: CreatePlantillaPayload | UpdatePlantillaPayload,
) {
  const { checklist, ...rest } = payload as CreatePlantillaPayload & {
    checklist?: string[];
  };
  const body: Record<string, unknown> = { ...rest };
  // Solo tocar metadata si se gestiona el checklist (el backend lo reemplaza).
  if (checklist !== undefined) body.metadata = { checklist };
  return body;
}

export async function createPlantilla(
  payload: CreatePlantillaPayload,
): Promise<Plantilla> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/plantillas-mantenimiento`, {
    body: JSON.stringify(buildPlantillaBody(payload)),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo crear la plantilla"),
    );
  }
  return (await response.json()) as Plantilla;
}

export async function updatePlantilla(
  id: string,
  payload: UpdatePlantillaPayload,
): Promise<Plantilla> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/plantillas-mantenimiento/${id}`,
    {
      body: JSON.stringify(buildPlantillaBody(payload)),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo actualizar la plantilla"),
    );
  }
  return (await response.json()) as Plantilla;
}

export async function desactivarPlantilla(id: string): Promise<Plantilla> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/plantillas-mantenimiento/${id}/desactivar`,
    { method: "PATCH" },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo desactivar la plantilla"),
    );
  }
  return (await response.json()) as Plantilla;
}

export async function reactivarPlantilla(id: string): Promise<Plantilla> {
  return updatePlantilla(id, { activo: true });
}

export async function addPlantillaItem(
  plantillaId: string,
  payload: AddPlantillaItemPayload,
): Promise<PlantillaItem> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/plantillas-mantenimiento/${plantillaId}/items`,
    {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(await extractError(response, "No se pudo agregar el ítem"));
  }
  return (await response.json()) as PlantillaItem;
}

export async function updatePlantillaItem(
  plantillaId: string,
  itemId: string,
  payload: UpdatePlantillaItemPayload,
): Promise<PlantillaItem> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/plantillas-mantenimiento/${plantillaId}/items/${itemId}`,
    {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo actualizar el ítem"),
    );
  }
  return (await response.json()) as PlantillaItem;
}

export async function removePlantillaItem(
  plantillaId: string,
  itemId: string,
): Promise<void> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/plantillas-mantenimiento/${plantillaId}/items/${itemId}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(await extractError(response, "No se pudo eliminar el ítem"));
  }
}
