import type { NotificacionTipo } from '@prisma/client';

export interface NotificacionPayload {
  ticketId?: string;
  ticketCodigo?: string;
  ticketTitulo?: string;
  ordenId?: string;
  ordenCodigo?: string;
  observacion?: string;
  actor?: { id: string; fullName?: string | null };
  mensaje?: string;
  [key: string]: unknown;
}

export interface NotificacionResponseDto {
  id: string;
  tipo: NotificacionTipo;
  payload: NotificacionPayload;
  leida: boolean;
  createdAt: string;
}
