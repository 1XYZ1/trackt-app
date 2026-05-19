import { authFetch } from "@/lib/api/http";

export type Repuesto = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  unidad: string;
  stockMinimo: number;
  activo: boolean;
  metadata: unknown;
  stockActual: number;
  stockReservado: number;
  stockDisponible: number;
  bajoStock: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RepuestoDetalle = Repuesto & {
  movimientosRecientes: MovimientoInventario[];
};

export type MovimientoTipo =
  | "ENTRADA"
  | "SALIDA"
  | "AJUSTE"
  | "RESERVA"
  | "LIBERACION"
  | "CONSUMO";

export type MovimientoInventario = {
  id: string;
  tenantId: string;
  repuestoId: string;
  tipo: MovimientoTipo;
  cantidad: number;
  stockResultante: number;
  usuarioId: string;
  ticketId: string | null;
  reservaId: string | null;
  observacion: string | null;
  metadata: unknown;
  createdAt: string;
  repuesto?: {
    id: string;
    codigo: string;
    nombre: string;
    unidad: string;
  };
};

export type ReservaEstado =
  | "SOLICITADA"
  | "RESERVADA"
  | "CONSUMIDA"
  | "LIBERADA"
  | "CANCELADA";

export type ReservaRepuesto = {
  id: string;
  tenantId: string;
  ticketId: string;
  estado: ReservaEstado;
  creadoPorId: string;
  aprobadoPorId: string | null;
  observacion: string | null;
  createdAt: string;
  updatedAt: string;
  items: ReservaItem[];
};

export type ReservaItem = {
  id: string;
  reservaId: string;
  repuestoId: string;
  cantidad: number;
  repuesto: {
    id: string;
    codigo: string;
    nombre: string;
    unidad: string;
  };
};

export type CreateRepuestoPayload = {
  codigo: string;
  nombre: string;
  descripcion?: string;
  categoria?: string;
  unidad?: string;
  stockMinimo?: number;
  stockInicial?: number;
};

// descripcion / categoria aceptan null para limpiar el campo en BD.
export type UpdateRepuestoPayload = {
  codigo?: string;
  nombre?: string;
  descripcion?: string | null;
  categoria?: string | null;
  unidad?: string;
  stockMinimo?: number;
  activo?: boolean;
};

export type EntradaStockPayload = {
  cantidad: number;
  observacion?: string;
};

export type AjusteStockPayload = {
  nuevoStockActual: number;
  observacion: string;
};

export type CreateReservaPayload = {
  observacion?: string;
  items: { repuestoId: string; cantidad: number }[];
  // Solo aplicable a mechanic. Si true, la reserva queda en estado SOLICITADA
  // y requiere aprobacion de admin/jefe.
  solicitar?: boolean;
};

export type ReservaActionPayload = {
  observacion?: string;
};

export type AprobarReservaPayload = {
  observacion?: string;
};

export type RepuestosFilters = {
  search?: string;
  categoria?: string;
  bajoStock?: boolean;
  includeInactive?: boolean;
};

export type MovimientosFilters = {
  repuestoId?: string;
  ticketId?: string;
  reservaId?: string;
  tipo?: MovimientoTipo;
  desde?: string; // ISO date (YYYY-MM-DD o full ISO)
  hasta?: string;
};

type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

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

// ============================================================
// Repuestos
// ============================================================

export async function getRepuestos(
  filters: RepuestosFilters = {},
): Promise<Repuesto[]> {
  assertApiBaseUrl();
  const qs = new URLSearchParams();
  if (filters.search) qs.set("search", filters.search);
  if (filters.categoria) qs.set("categoria", filters.categoria);
  if (filters.bajoStock) qs.set("bajoStock", "true");
  if (filters.includeInactive) qs.set("includeInactive", "true");
  qs.set("limit", "200");

  const response = await authFetch(
    `${API_BASE_URL}/inventario/repuestos?${qs.toString()}`,
  );
  if (!response.ok) {
    throw new Error("No se pudieron cargar los repuestos");
  }
  const result = (await response.json()) as Paginated<Repuesto>;
  return result.data;
}

export async function getRepuestoById(id: string): Promise<RepuestoDetalle> {
  assertApiBaseUrl();
  const response = await authFetch(`${API_BASE_URL}/inventario/repuestos/${id}`);
  if (!response.ok) {
    throw new Error("No se pudo cargar el detalle del repuesto");
  }
  return (await response.json()) as RepuestoDetalle;
}

export async function createRepuesto(
  payload: CreateRepuestoPayload,
): Promise<Repuesto> {
  assertApiBaseUrl();
  const response = await authFetch(`${API_BASE_URL}/inventario/repuestos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await extractError(response, "No se pudo crear el repuesto"));
  }
  return (await response.json()) as Repuesto;
}

export async function updateRepuesto(
  id: string,
  payload: UpdateRepuestoPayload,
): Promise<Repuesto> {
  assertApiBaseUrl();
  const response = await authFetch(`${API_BASE_URL}/inventario/repuestos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo actualizar el repuesto"),
    );
  }
  return (await response.json()) as Repuesto;
}

export async function desactivarRepuesto(id: string): Promise<Repuesto> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/inventario/repuestos/${id}/desactivar`,
    { method: "PATCH" },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo desactivar el repuesto"),
    );
  }
  return (await response.json()) as Repuesto;
}

export async function entradaStock(
  id: string,
  payload: EntradaStockPayload,
): Promise<Repuesto> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/inventario/repuestos/${id}/entrada`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo registrar la entrada"),
    );
  }
  return (await response.json()) as Repuesto;
}

export async function ajusteStock(
  id: string,
  payload: AjusteStockPayload,
): Promise<Repuesto> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/inventario/repuestos/${id}/ajuste`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(await extractError(response, "No se pudo ajustar el stock"));
  }
  return (await response.json()) as Repuesto;
}

// ============================================================
// Movimientos
// ============================================================

export async function getMovimientos(
  filters: MovimientosFilters = {},
): Promise<MovimientoInventario[]> {
  assertApiBaseUrl();
  const qs = new URLSearchParams();
  if (filters.repuestoId) qs.set("repuestoId", filters.repuestoId);
  if (filters.ticketId) qs.set("ticketId", filters.ticketId);
  if (filters.reservaId) qs.set("reservaId", filters.reservaId);
  if (filters.tipo) qs.set("tipo", filters.tipo);
  if (filters.desde) qs.set("desde", filters.desde);
  if (filters.hasta) qs.set("hasta", filters.hasta);
  qs.set("limit", "100");

  const response = await authFetch(
    `${API_BASE_URL}/inventario/movimientos?${qs.toString()}`,
  );
  if (!response.ok) {
    throw new Error("No se pudieron cargar los movimientos");
  }
  const result = (await response.json()) as Paginated<MovimientoInventario>;
  return result.data;
}

// ============================================================
// Reservas
// ============================================================

export async function getReservasByTicket(
  ticketId: string,
): Promise<ReservaRepuesto[]> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/tickets/${ticketId}/reservas-repuestos`,
  );
  if (!response.ok) {
    throw new Error("No se pudieron cargar las reservas del ticket");
  }
  return (await response.json()) as ReservaRepuesto[];
}

export async function createReserva(
  ticketId: string,
  payload: CreateReservaPayload,
): Promise<ReservaRepuesto> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/tickets/${ticketId}/reservas-repuestos`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(await extractError(response, "No se pudo crear la reserva"));
  }
  return (await response.json()) as ReservaRepuesto;
}

export async function liberarReserva(
  id: string,
  payload: ReservaActionPayload = {},
): Promise<ReservaRepuesto> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/reservas-repuestos/${id}/liberar`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(await extractError(response, "No se pudo liberar la reserva"));
  }
  return (await response.json()) as ReservaRepuesto;
}

export async function consumirReserva(
  id: string,
  payload: ReservaActionPayload = {},
): Promise<ReservaRepuesto> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/reservas-repuestos/${id}/consumir`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo consumir la reserva"),
    );
  }
  return (await response.json()) as ReservaRepuesto;
}

export async function aprobarReserva(
  id: string,
  payload: AprobarReservaPayload = {},
): Promise<ReservaRepuesto> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/reservas-repuestos/${id}/aprobar`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo aprobar la reserva"),
    );
  }
  return (await response.json()) as ReservaRepuesto;
}

/**
 * Listado global de reservas pendientes (SOLICITADA). Solo admin/jefe_taller.
 */
export async function getReservasPendientes(): Promise<ReservaRepuesto[]> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/reservas-repuestos`,
  );
  if (!response.ok) {
    throw new Error("No se pudieron cargar las reservas pendientes");
  }
  return (await response.json()) as ReservaRepuesto[];
}
