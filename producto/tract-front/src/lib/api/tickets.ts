import type { Equipo } from "@/lib/api/equipos";
import { authFetch } from "@/lib/api/http";
import type { OrdenPrioridad } from "@/lib/api/ordenes";
import type { TicketEstado, UsuarioResumen } from "@/components/core";

export type TicketPrioridad = OrdenPrioridad;

export type TicketTimelineEvent = {
  id: string;
  estadoAnterior?: TicketEstado | null;
  estadoNuevo: TicketEstado;
  usuario?: UsuarioResumen | null;
  observacion?: string | null;
  timestamp: string;
};

export type TicketTrabajo = {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  estado: TicketEstado;
  prioridad: TicketPrioridad;
  ordenId: string;
  ordenCodigo?: string | null;
  equipo?: Equipo | null;
  equipoNombre?: string | null;
  mecanico?: UsuarioResumen | null;
  createdAt?: string;
  timeline?: TicketTimelineEvent[];
};

export type CreateTicketPayload = {
  titulo: string;
  descripcion: string;
  prioridad: TicketPrioridad;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

function assertApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL no esta configurada");
  }
}

async function parseJsonResponse<T>(
  response: Response,
  errorMessage: string,
): Promise<T> {
  if (!response.ok) {
    throw new Error(errorMessage);
  }

  return response.json();
}

export function getTicketEquipoLabel(ticket: TicketTrabajo): string {
  if (ticket.equipo) {
    return `${ticket.equipo.codigo} - ${ticket.equipo.nombre}`;
  }

  return ticket.equipoNombre ?? "Equipo sin informacion";
}

/** Firma común de authFetch (cliente) y del fetcher con token del servidor. */
export type TicketFetcher = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

type PaginatedTickets = {
  data: TicketTrabajo[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

const TICKETS_PAGE_SIZE = 100; // máximo permitido por el backend (PaginationQueryDto)

async function fetchTicketsPage(
  fetcher: TicketFetcher,
  page: number,
): Promise<PaginatedTickets> {
  const response = await fetcher(
    `${API_BASE_URL}/tickets?page=${page}&limit=${TICKETS_PAGE_SIZE}`,
  );
  return parseJsonResponse<PaginatedTickets>(
    response,
    "No se pudieron cargar los tickets",
  );
}

/**
 * Trae TODOS los tickets del tenant iterando las páginas del backend.
 *
 * El listado pagina con limit por defecto 10; consumirlo sin params mostraba
 * solo los primeros 10 (bug). El kanban y la vista lista necesitan el conjunto
 * completo de tickets abiertos, así que paginamos hasta totalPages: la primera
 * página secuencial (para conocer totalPages) y el resto en paralelo.
 */
export async function getAllTickets(
  fetcher: TicketFetcher = authFetch,
): Promise<TicketTrabajo[]> {
  assertApiBaseUrl();

  const first = await fetchTicketsPage(fetcher, 1);
  if (first.meta.totalPages > 10 || first.meta.total > 1000) {
    // Señal para migrar a filtrado server-side si un tenant crece mucho.
    console.warn(
      `[tickets] ${first.meta.total} tickets — considerar filtrado server-side`,
    );
  }
  if (first.meta.totalPages <= 1) return first.data;

  const restPages = Array.from(
    { length: first.meta.totalPages - 1 },
    (_, i) => i + 2,
  );
  const rest = await Promise.all(
    restPages.map((page) => fetchTicketsPage(fetcher, page)),
  );
  return [first.data, ...rest.map((r) => r.data)].flat();
}

export async function getTickets(): Promise<TicketTrabajo[]> {
  return getAllTickets();
}

export async function getTicketById(id: string): Promise<TicketTrabajo> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/tickets/${id}`);
  return parseJsonResponse<TicketTrabajo>(
    response,
    "No se pudo cargar el detalle del ticket",
  );
}

export async function createTicketFromOrden(
  ordenId: string,
  payload: CreateTicketPayload,
): Promise<TicketTrabajo> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/ordenes/${ordenId}/tickets`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return parseJsonResponse<TicketTrabajo>(
    response,
    "No se pudo crear el ticket",
  );
}

// ---------- Transiciones de estado (TRA-31) ----------

export type AsignarTicketPayload = {
  mecanicoId: string;
};

export type ReasignarTicketPayload = {
  mecanicoId: string;
  motivo?: string;
};

export type CargaMecanico = {
  mecanicoId: string;
  nombre: string | null;
  email: string | null;
  pendientes: number;
  asignados: number;
  enEjecucion: number;
  ejecutados: number;
  totalAbiertos: number;
};

export type FinalizarTicketRawPayload = {
  observacion?: string;
};

export type ValidarTicketPayload = {
  aprobado: boolean;
  observacion?: string;
};

export type CerrarTicketPayload = {
  observacion?: string;
};

async function postTicketTransition<T extends object>(
  ticketId: string,
  path: string,
  payload: T,
  errorMessage: string,
): Promise<TicketTrabajo> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/tickets/${ticketId}/${path}`,
    {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  return parseJsonResponse<TicketTrabajo>(response, errorMessage);
}

export function asignarTicket(
  ticketId: string,
  payload: AsignarTicketPayload,
): Promise<TicketTrabajo> {
  return postTicketTransition(
    ticketId,
    "asignar",
    payload,
    "No se pudo asignar el ticket",
  );
}

/**
 * Iniciar ejecución desde el kanban (ASIGNADO → EN_EJECUCION). Devuelve el
 * TicketTrabajo crudo para actualizar la cache ["tickets"]. La versión adaptada
 * a MisTicket vive en lib/api/mis-tickets.ts (vista del mecánico).
 */
export function iniciarTicket(ticketId: string): Promise<TicketTrabajo> {
  return postTicketTransition(
    ticketId,
    "iniciar",
    {},
    "No se pudo iniciar el ticket",
  );
}

/** Finalizar ejecución desde el kanban (EN_EJECUCION → EJECUTADO). */
export function finalizarTicket(
  ticketId: string,
  payload: FinalizarTicketRawPayload,
): Promise<TicketTrabajo> {
  return postTicketTransition(
    ticketId,
    "finalizar",
    payload,
    "No se pudo finalizar el ticket",
  );
}

async function extractError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as {
      message?: string | string[];
    };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    // sin body json
  }
  return fallback;
}

export async function reasignarTicket(
  ticketId: string,
  payload: ReasignarTicketPayload,
): Promise<TicketTrabajo> {
  assertApiBaseUrl();
  const response = await authFetch(
    `${API_BASE_URL}/tickets/${ticketId}/reasignar`,
    {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(
      await extractError(response, "No se pudo reasignar el ticket"),
    );
  }
  return (await response.json()) as TicketTrabajo;
}

export async function getCargaMecanicos(): Promise<CargaMecanico[]> {
  assertApiBaseUrl();
  const response = await authFetch(`${API_BASE_URL}/tickets/carga-mecanicos`);
  if (!response.ok) {
    throw new Error("No se pudo cargar la carga de mecánicos");
  }
  return (await response.json()) as CargaMecanico[];
}

export function validarTicket(
  ticketId: string,
  payload: ValidarTicketPayload,
): Promise<TicketTrabajo> {
  return postTicketTransition(
    ticketId,
    "validar",
    payload,
    "No se pudo validar el ticket",
  );
}

export function cerrarTicket(
  ticketId: string,
  payload: CerrarTicketPayload,
): Promise<TicketTrabajo> {
  return postTicketTransition(
    ticketId,
    "cerrar",
    payload,
    "No se pudo cerrar el ticket",
  );
}
