export type TicketEstado =
  | "PENDIENTE"
  | "ASIGNADO"
  | "EN_EJECUCION"
  | "EJECUTADO"
  | "CERRADO"
  | "CANCELADO";

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
