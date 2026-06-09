import type { TicketEstado } from "@/components/core";
import type { UserRole } from "@/lib/auth/profile";
import type { TicketTrabajo } from "@/lib/api/tickets";

/**
 * Acción de transición disparada al soltar una card en una columna del kanban.
 * Cada una mapea a un endpoint POST /tickets/:id/{...} del backend.
 */
export type TransitionAction =
  | "asignar" // PENDIENTE → ASIGNADO   (dialog: elegir mecánico)
  | "iniciar" // ASIGNADO → EN_EJECUCION (sin dialog, optimista directo)
  | "finalizar" // EN_EJECUCION → EJECUTADO (dialog: observación opcional)
  | "validar_aprobar" // EJECUTADO → CERRADO   (dialog ValidarTicket aprobar)
  | "validar_rechazar"; // EJECUTADO → EN_EJECUCION (dialog ValidarTicket rechazar)

export type TicketTransition = {
  from: TicketEstado;
  to: TicketEstado;
  action: TransitionAction;
  roles: UserRole[];
  /** Exige que el usuario actual sea el mecánico asignado al ticket. */
  soloMecanicoAsignado?: boolean;
  /** true salvo "iniciar": el drop abre un dialog antes de mutar. */
  requiereDialog: boolean;
};

/**
 * Fuente única de verdad de las transiciones válidas por drag-and-drop.
 *
 * Refleja exactamente los @Roles del backend (tickets.controller.ts):
 * iniciar/finalizar son SOLO del mecánico asignado; asignar/reasignar de
 * admin/jefe_taller; validar/cerrar de admin. Reasignar NO es drag (se hace
 * por dialog desde el detalle). CANCELADO nunca es destino de un drag.
 */
export const TICKET_TRANSITIONS: TicketTransition[] = [
  {
    from: "PENDIENTE",
    to: "ASIGNADO",
    action: "asignar",
    roles: ["admin", "jefe_taller"],
    requiereDialog: true,
  },
  {
    from: "ASIGNADO",
    to: "EN_EJECUCION",
    action: "iniciar",
    roles: ["mechanic"],
    soloMecanicoAsignado: true,
    requiereDialog: false,
  },
  {
    from: "EN_EJECUCION",
    to: "EJECUTADO",
    action: "finalizar",
    roles: ["mechanic"],
    soloMecanicoAsignado: true,
    requiereDialog: true,
  },
  {
    from: "EJECUTADO",
    to: "CERRADO",
    action: "validar_aprobar",
    roles: ["admin"],
    requiereDialog: true,
  },
  {
    from: "EJECUTADO",
    to: "EN_EJECUCION",
    action: "validar_rechazar",
    roles: ["admin"],
    requiereDialog: true,
  },
];

function isAllowed(
  transition: TicketTransition,
  ticket: TicketTrabajo,
  role: UserRole,
  userId: string,
): boolean {
  if (!transition.roles.includes(role)) return false;
  if (transition.soloMecanicoAsignado && ticket.mecanico?.id !== userId) {
    return false;
  }
  return true;
}

/** Transición concreta (si existe y es permitida) de `ticket` hacia `to`. */
export function getTransition(
  ticket: TicketTrabajo,
  to: TicketEstado,
  role: UserRole,
  userId: string,
): TicketTransition | null {
  const transition = TICKET_TRANSITIONS.find(
    (t) => t.from === ticket.estado && t.to === to,
  );
  if (!transition) return null;
  return isAllowed(transition, ticket, role, userId) ? transition : null;
}

/** Estados destino a los que el usuario actual puede arrastrar el ticket. */
export function getValidTargets(
  ticket: TicketTrabajo,
  role: UserRole,
  userId: string,
): TicketEstado[] {
  return TICKET_TRANSITIONS.filter(
    (t) => t.from === ticket.estado && isAllowed(t, ticket, role, userId),
  ).map((t) => t.to);
}

/** ¿El ticket tiene al menos una transición arrastrable para este usuario? */
export function canDrag(
  ticket: TicketTrabajo,
  role: UserRole,
  userId: string,
): boolean {
  return getValidTargets(ticket, role, userId).length > 0;
}
