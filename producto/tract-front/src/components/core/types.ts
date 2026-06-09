/**
 * Orden canónico del workflow de un ticket. Fuente única para columnas kanban,
 * grupos de la vista lista y botones de filtro — evita arrays hardcodeados
 * duplicados por la app (antes vivían sueltos en tickets-client.tsx).
 */
export const TICKET_ESTADOS = [
  "PENDIENTE",
  "ASIGNADO",
  "EN_EJECUCION",
  "EJECUTADO",
  "CERRADO",
  "CANCELADO",
] as const;

export type TicketEstado = (typeof TICKET_ESTADOS)[number];

/** Estados con trabajo vivo (excluye terminales CERRADO/CANCELADO). */
export const TICKET_ESTADOS_ABIERTOS = [
  "PENDIENTE",
  "ASIGNADO",
  "EN_EJECUCION",
  "EJECUTADO",
] as const satisfies readonly TicketEstado[];

const TICKET_ESTADO_LABELS: Record<TicketEstado, string> = {
  PENDIENTE: "Pendiente",
  ASIGNADO: "Asignado",
  EN_EJECUCION: "En ejecucion",
  EJECUTADO: "Ejecutado",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

/** Etiqueta legible de un estado; acepta "TODOS" para el filtro global. */
export function ticketEstadoLabel(estado: TicketEstado | "TODOS"): string {
  if (estado === "TODOS") return "Todos";
  return TICKET_ESTADO_LABELS[estado];
}

export type OtEstado = TicketEstado;

export type TracktEstado = TicketEstado | OtEstado;

export interface UsuarioResumen {
  id?: string;
  nombre?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface TicketResumen {
  codigo: string;
  titulo: string;
  equipo: string;
  estado: TicketEstado;
  mecanico?: UsuarioResumen | null;
}

export interface OtResumen {
  codigo: string;
  equipo: string;
  descripcion: string;
  estado: OtEstado;
  ticketsCount: number;
}

export interface TimelineEvento {
  id: string;
  titulo: string;
  descripcion?: string;
  estado?: TracktEstado;
  fecha: string;
  usuario?: UsuarioResumen | null;
}

export type EmptyStateIconName =
  | "clipboard"
  | "inbox"
  | "search"
  | "ticket"
  | "wrench";
