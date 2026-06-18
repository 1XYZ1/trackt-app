import { authFetch } from "@/lib/api/http";

export type EquipoEstadoOperativo =
  | "OPERATIVO"
  | "EN_MANTENIMIENTO"
  | "FUERA_DE_SERVICIO";

// Item de LISTA (GET /equipos). estadoOperativo es NOT NULL en BD.
export type Equipo = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string | null;
  // Nullable en BD: el backend devuelve null si el campo se limpió.
  marca: string | null;
  modelo: string | null;
  ubicacion: string | null;
  estadoOperativo: EquipoEstadoOperativo;
  activo?: boolean;
};

// DETALLE (GET /equipos/:id, qr, create/update). Superset de Equipo.
export type EquipoDetalle = Equipo & {
  numeroSerie: string | null;
  fechaInstalacion: string | null;
  fechaCompra: string | null;
  qrToken: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
};

export type EquipoAlerta = {
  tipo:
    | "EQUIPO_INACTIVO"
    | "FUERA_DE_SERVICIO"
    | "EN_MANTENIMIENTO"
    | "OT_PRIORIDAD_ALTA";
  mensaje: string;
};

export type EquipoResumen = {
  equipo: EquipoDetalle;
  estadisticas: {
    ordenesAbiertas: number;
    ordenesCerradas: number;
    ticketsActivos: number;
    ticketsCerrados: number;
    reservasActivas: number;
    repuestosConsumidos: number;
  };
  ultimasOrdenes: Array<{
    id: string;
    codigo: string;
    descripcion: string;
    prioridad: string;
    estado: string;
    fechaCierre: string | null;
    createdAt: string;
  }>;
  ultimosTickets: Array<{
    id: string;
    codigo: string;
    titulo: string;
    estado: string;
    prioridad: string;
    otId: string | null;
    createdAt: string;
  }>;
  proximasProgramaciones: Array<{
    id: string;
    titulo: string;
    fechaProgramada: string;
    estado: string;
    prioridad: string;
    plantilla: { id: string; nombre: string } | null;
  }>;
  alertas: EquipoAlerta[];
};

// Límite de página del listado (sin UI de paginación todavía). Se expone para
// que la UI pueda avisar cuando la lista se trunca.
// Debe respetar @Max(100) del PaginationQueryDto del backend; pedir más devuelve 400.
export const EQUIPOS_PAGE_LIMIT = 100;

export type CreateEquipoPayload = {
  codigo: string;
  nombre: string;
  tipo?: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  ubicacion?: string;
  estadoOperativo?: EquipoEstadoOperativo;
  // ISO string (Date en backend).
  fechaInstalacion?: string;
  fechaCompra?: string;
};

// Update permite null en campos opcionales para limpiarlos en BD.
// estadoOperativo NO acepta null (es NOT NULL en BD).
export type UpdateEquipoPayload = {
  codigo?: string;
  nombre?: string;
  tipo?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  ubicacion?: string | null;
  estadoOperativo?: EquipoEstadoOperativo;
  fechaInstalacion?: string | null;
  fechaCompra?: string | null;
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

type PaginatedEquipos = {
  data: Equipo[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

async function fetchEquiposPage(
  page: number,
  filters: EquiposFilters,
): Promise<PaginatedEquipos> {
  const params = new URLSearchParams();
  if (filters.includeInactive) {
    params.set("includeInactive", "true");
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  params.set("page", String(page));
  params.set("limit", String(EQUIPOS_PAGE_LIMIT));

  const response = await authFetch(`${API_BASE_URL}/equipos?${params.toString()}`);

  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudieron cargar los equipos"),
    );
  }

  return (await response.json()) as PaginatedEquipos;
}

// Trae todos los equipos recorriendo las páginas (limit<=100 por @Max del backend).
export async function getEquipos(
  filters: EquiposFilters = {},
): Promise<Equipo[]> {
  assertApiBaseUrl();

  const first = await fetchEquiposPage(1, filters);
  if (first.meta.totalPages <= 1) return first.data;

  const restPages = Array.from(
    { length: first.meta.totalPages - 1 },
    (_, i) => i + 2,
  );
  const rest = await Promise.all(restPages.map((p) => fetchEquiposPage(p, filters)));
  return [first.data, ...rest.map((r) => r.data)].flat();
}

export async function getEquipo(id: string): Promise<EquipoDetalle> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/equipos/${id}`);
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo cargar el equipo"),
    );
  }
  return (await response.json()) as EquipoDetalle;
}

export async function getEquipoResumen(id: string): Promise<EquipoResumen> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/equipos/${id}/resumen`);
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo cargar el resumen del equipo"),
    );
  }
  return (await response.json()) as EquipoResumen;
}

// Regenera el qrToken (admin). Invalida el token anterior.
export async function generarQr(id: string): Promise<EquipoDetalle> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/equipos/${id}/qr`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo generar el código QR"),
    );
  }
  return (await response.json()) as EquipoDetalle;
}

export async function getEquipoByQr(token: string): Promise<EquipoDetalle> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/equipos/qr/${token}`);
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se encontró el equipo del código QR"),
    );
  }
  return (await response.json()) as EquipoDetalle;
}

export type HistorialFiltros = {
  desde?: string;
  hasta?: string;
  estado?: string;
};

export type EquipoHistorial = {
  equipo: EquipoDetalle;
  filtros: { desde: string | null; hasta: string | null; estado: string | null };
  ordenes: Array<{
    id: string;
    codigo: string;
    descripcion: string;
    prioridad: string;
    estado: string;
    fechaCierre: string | null;
    createdAt: string;
  }>;
  tickets: Array<{
    id: string;
    codigo: string;
    titulo: string;
    estado: string;
    prioridad: string;
    otId: string | null;
    mecanicoId: string | null;
    fechaCierre: string | null;
    createdAt: string;
  }>;
  evidencias: Array<{
    id: string;
    ticketId: string | null;
    storagePath: string;
    descripcion: string | null;
    createdAt: string;
    ticket: { codigo: string } | null;
  }>;
  reservas: Array<{
    id: string;
    ticketId: string | null;
    estado: string;
    observacion: string | null;
    createdAt: string;
    ticket: { codigo: string } | null;
    items: Array<{
      cantidad: number;
      repuesto: { id: string; codigo: string; nombre: string; unidad: string };
    }>;
  }>;
  movimientos: Array<{
    id: string;
    tipo: string;
    cantidad: number;
    stockResultante: number;
    ticketId: string | null;
    reservaId: string | null;
    observacion: string | null;
    createdAt: string;
    repuesto: { id: string; codigo: string; nombre: string; unidad: string };
  }>;
  repuestosConsumidos: Array<{
    repuestoId: string;
    codigo: string;
    nombre: string | null;
    unidad: string | null;
    cantidadConsumida: number;
    movimientos: number;
  }>;
  programaciones: Array<{
    id: string;
    titulo: string;
    fechaProgramada: string;
    estado: string;
    prioridad: string;
    recurrencia: string | null;
    plantilla: { id: string; nombre: string } | null;
    metadata: unknown;
  }>;
};

export async function getEquipoHistorial(
  id: string,
  filtros: HistorialFiltros = {},
): Promise<EquipoHistorial> {
  assertApiBaseUrl();

  const params = new URLSearchParams();
  if (filtros.desde) params.set("desde", filtros.desde);
  if (filtros.hasta) params.set("hasta", filtros.hasta);
  if (filtros.estado) params.set("estado", filtros.estado);
  const qs = params.toString();

  const response = await authFetch(
    `${API_BASE_URL}/equipos/${id}/historial${qs ? `?${qs}` : ""}`,
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo cargar el historial del equipo"),
    );
  }
  return (await response.json()) as EquipoHistorial;
}

// ============================================================
// Repuestos asociados al equipo (array plano, no paginado)
// ============================================================

export type EquipoRepuesto = {
  id: string;
  equipoId: string;
  cantidadRef: number | null;
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

export type AddEquipoRepuestoPayload = {
  repuestoId: string;
  cantidadRef?: number;
  observacion?: string;
};

export async function getEquipoRepuestos(
  id: string,
): Promise<EquipoRepuesto[]> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/equipos/${id}/repuestos`);
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudieron cargar los repuestos del equipo"),
    );
  }
  return (await response.json()) as EquipoRepuesto[];
}

export async function addEquipoRepuesto(
  id: string,
  payload: AddEquipoRepuestoPayload,
): Promise<EquipoRepuesto> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/equipos/${id}/repuestos`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo asociar el repuesto"),
    );
  }
  return (await response.json()) as EquipoRepuesto;
}

export async function removeEquipoRepuesto(
  id: string,
  repuestoId: string,
): Promise<void> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/equipos/${id}/repuestos/${repuestoId}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo quitar el repuesto"),
    );
  }
}

// ============================================================
// Plantillas asociadas al equipo (array plano, no paginado)
// ============================================================

export type EquipoPlantilla = {
  id: string;
  equipoId: string;
  createdAt: string;
  plantilla: {
    id: string;
    nombre: string;
    descripcion: string | null;
    tipoEquipo: string | null;
    frecuencia: string | null;
    activo: boolean;
    itemsCount: number;
  };
};

export async function getEquipoPlantillas(
  equipoId: string,
): Promise<EquipoPlantilla[]> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/equipos/${equipoId}/plantillas`,
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudieron cargar las plantillas del equipo"),
    );
  }
  return (await response.json()) as EquipoPlantilla[];
}

export async function addEquipoPlantilla(
  equipoId: string,
  plantillaId: string,
): Promise<EquipoPlantilla> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/equipos/${equipoId}/plantillas/${plantillaId}`,
    { method: "POST" },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo asociar la plantilla"),
    );
  }
  return (await response.json()) as EquipoPlantilla;
}

export async function removeEquipoPlantilla(
  equipoId: string,
  plantillaId: string,
): Promise<void> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/equipos/${equipoId}/plantillas/${plantillaId}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo quitar la plantilla"),
    );
  }
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

// Cambio acotado de estado operativo (página QR mobile). Permitido a
// admin/jefe/mecánico en el backend, a diferencia del updateEquipo general.
export async function cambiarEstadoOperativo(
  id: string,
  estadoOperativo: EquipoEstadoOperativo,
): Promise<EquipoDetalle> {
  assertApiBaseUrl();

  const response = await authFetch(
    `${API_BASE_URL}/equipos/${id}/estado-operativo`,
    {
      body: JSON.stringify({ estadoOperativo }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo cambiar el estado operativo"),
    );
  }
  return (await response.json()) as EquipoDetalle;
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
