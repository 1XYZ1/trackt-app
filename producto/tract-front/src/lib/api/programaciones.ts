import { authFetch } from "@/lib/api/http";

export type ProgramacionEstado =
  | "PROGRAMADA"
  | "GENERADA"
  | "CANCELADA"
  | "VENCIDA"
  | "COMPLETADA";

export type Prioridad = "BAJA" | "MEDIA" | "ALTA";

export type Programacion = {
  id: string;
  tenantId: string;
  equipoId: string;
  plantillaId: string | null;
  titulo: string;
  descripcion: string | null;
  fechaProgramada: string;
  responsableId: string | null;
  prioridad: Prioridad;
  estado: ProgramacionEstado;
  recurrencia: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  equipo: { id: string; codigo: string; nombre: string };
  plantilla: { id: string; nombre: string } | null;
};

// Evento del calendario (no paginado, campos renombrados title/start).
export type EventoCalendario = {
  id: string;
  title: string;
  start: string;
  estado: ProgramacionEstado;
  prioridad: Prioridad;
  equipo: { id: string; codigo: string; nombre: string };
  plantilla: { id: string; nombre: string } | null;
};

export type ProgramacionesFilters = {
  desde?: string;
  hasta?: string;
  equipoId?: string;
  estado?: ProgramacionEstado;
  responsableId?: string;
  plantillaId?: string;
};

export type CreateProgramacionPayload = {
  equipoId: string;
  plantillaId?: string;
  titulo?: string;
  descripcion?: string;
  fechaProgramada: string;
  responsableId?: string;
  prioridad?: Prioridad;
  recurrencia?: string;
};

export type UpdateProgramacionPayload = {
  titulo?: string;
  descripcion?: string | null;
  plantillaId?: string | null;
  fechaProgramada?: string;
  responsableId?: string | null;
  prioridad?: Prioridad;
  recurrencia?: string | null;
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

type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

function buildFilterParams(filters: ProgramacionesFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);
  if (filters.equipoId) params.set("equipoId", filters.equipoId);
  if (filters.estado) params.set("estado", filters.estado);
  if (filters.responsableId) params.set("responsableId", filters.responsableId);
  if (filters.plantillaId) params.set("plantillaId", filters.plantillaId);
  return params;
}

async function fetchProgramacionesPage(
  page: number,
  filters: ProgramacionesFilters,
): Promise<Paginated<Programacion>> {
  const params = buildFilterParams(filters);
  params.set("page", String(page));
  params.set("limit", String(MAX_PAGE_LIMIT));

  const response = await authFetch(
    `${API_BASE_URL}/programaciones-mantenimiento?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudieron cargar las programaciones"),
    );
  }
  return (await response.json()) as Paginated<Programacion>;
}

export async function getProgramaciones(
  filters: ProgramacionesFilters = {},
): Promise<Programacion[]> {
  assertApiBaseUrl();

  const first = await fetchProgramacionesPage(1, filters);
  if (first.meta.totalPages <= 1) return first.data;

  const restPages = Array.from(
    { length: first.meta.totalPages - 1 },
    (_, i) => i + 2,
  );
  const rest = await Promise.all(
    restPages.map((p) => fetchProgramacionesPage(p, filters)),
  );
  return [first.data, ...rest.map((r) => r.data)].flat();
}

export async function getCalendario(
  desde: string,
  hasta: string,
): Promise<EventoCalendario[]> {
  assertApiBaseUrl();

  const params = new URLSearchParams({ desde, hasta });
  const response = await authFetch(
    `${API_BASE_URL}/programaciones-mantenimiento/calendario?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo cargar el calendario"),
    );
  }
  // Respuesta es un array plano (sin envelope).
  return (await response.json()) as EventoCalendario[];
}

export async function getProgramacion(id: string): Promise<Programacion> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/programaciones-mantenimiento/${id}`,
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo cargar la programación"),
    );
  }
  return (await response.json()) as Programacion;
}

export async function createProgramacion(
  payload: CreateProgramacionPayload,
): Promise<Programacion> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/programaciones-mantenimiento`,
    {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo crear la programación"),
    );
  }
  return (await response.json()) as Programacion;
}

export async function updateProgramacion(
  id: string,
  payload: UpdateProgramacionPayload,
): Promise<Programacion> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/programaciones-mantenimiento/${id}`,
    {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo actualizar la programación"),
    );
  }
  return (await response.json()) as Programacion;
}

export async function cancelarProgramacion(id: string): Promise<Programacion> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/programaciones-mantenimiento/${id}/cancelar`,
    { method: "PATCH" },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo cancelar la programación"),
    );
  }
  return (await response.json()) as Programacion;
}

// ============================================================
// Generar OT desde programación (fase 5)
// ============================================================

export type GenerarOtPayload = {
  modoReserva?: "AUTOMATICA" | "SUGERIDA";
  ajustarItems?: Array<{ repuestoId: string; cantidad: number }>;
  observacion?: string;
};

export type ItemSugerido = {
  repuestoId: string;
  cantidad: number;
  obligatorio: boolean;
  repuesto: {
    codigo: string;
    nombre: string;
    unidad: string;
    stockDisponible: number;
  };
};

export type GenerarOtResult = {
  programacion: Programacion;
  ot: { id: string; codigo: string };
  ticket: { id: string; codigo: string };
  reserva: { id: string; estado: string } | null;
  itemsSugeridos?: ItemSugerido[];
};

// Parsea el 409 estructurado de stock insuficiente (modo AUTOMATICA).
async function extractGenerarOtError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string | string[];
      faltantes?: Array<{
        codigo: string;
        nombre: string;
        requerido: number;
        disponible: number;
      }>;
    };
    if (
      typeof body.message === "string" &&
      body.message &&
      body.faltantes?.length
    ) {
      const detalle = body.faltantes
        .map(
          (f) =>
            `${f.codigo} (disponible ${f.disponible}, requerido ${f.requerido})`,
        )
        .join(", ");
      return `${body.message}: ${detalle}`;
    }
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    // sin body json
  }
  return "No se pudo generar la OT";
}

export async function generarOt(
  id: string,
  payload: GenerarOtPayload = {},
): Promise<GenerarOtResult> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/programaciones-mantenimiento/${id}/generar-ot`,
    {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(await extractGenerarOtError(response));
  }
  return (await response.json()) as GenerarOtResult;
}
