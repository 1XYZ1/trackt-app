import { Prioridad, TicketEstado } from '@prisma/client';

export interface UsuarioResumenDto {
  id: string;
  nombre?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface EquipoResumenDto {
  id: string;
  codigo: string;
  nombre: string;
  marca?: string | null;
  modelo?: string | null;
  ubicacion?: string | null;
}

export interface TicketTimelineEventDto {
  id: string;
  estadoAnterior: TicketEstado | null;
  estadoNuevo: TicketEstado;
  usuario: UsuarioResumenDto | null;
  observacion: string | null;
  timestamp: string;
}

// Paso del checklist del ticket (copiado de la plantilla al generar/crear).
// Vive en Ticket.metadata.checklist; el mecánico lo marca durante EN_EJECUCION.
export interface ChecklistPasoDto {
  paso: string;
  hecho: boolean;
}

/**
 * Shape de respuesta de ticket consumido por el frontend
 * (matchea `TicketTrabajo` en `producto/tract-front/src/lib/api/tickets.ts`).
 */
export interface TicketResponseDto {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  estado: TicketEstado;
  prioridad: Prioridad;
  ordenId: string;
  ordenCodigo: string | null;
  equipo: EquipoResumenDto | null;
  equipoNombre: string | null;
  mecanico: UsuarioResumenDto | null;
  createdAt: string;
  // Checklist de mantención (de la plantilla). [] si el ticket no tiene receta.
  checklist: ChecklistPasoDto[];
  timeline?: TicketTimelineEventDto[];
}
