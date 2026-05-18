import type { NotificacionTipo } from '@prisma/client';

export interface NotificacionPayload {
  ticketId?: string;
  ticketCodigo?: string;
  ordenId?: string;
  ordenCodigo?: string;
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
