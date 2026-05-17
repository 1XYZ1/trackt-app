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

export async function getTickets(): Promise<TicketTrabajo[]> {
  assertApiBaseUrl();

  const response = await authFetch(`${API_BASE_URL}/tickets`);
  return parseJsonResponse<TicketTrabajo[]>(
    response,
    "No se pudieron cargar los tickets",
  );
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
