import {
  EquipoEstadoOperativo,
  OrdenTrabajoEstado,
  Prioridad,
  TicketEstado,
} from '@prisma/client';

export interface EquipoEstadisticasDto {
  ordenesAbiertas: number;
  ordenesCerradas: number;
  ticketsActivos: number;
  ticketsCerrados: number;
  reservasActivas: number;
  repuestosConsumidos: number;
}

export interface EquipoAlertaDto {
  tipo:
    | 'EQUIPO_INACTIVO'
    | 'FUERA_DE_SERVICIO'
    | 'EN_MANTENIMIENTO'
    | 'OT_PRIORIDAD_ALTA';
  mensaje: string;
}

export interface OrdenResumenDto {
  id: string;
  codigo: string;
  descripcion: string;
  prioridad: Prioridad;
  estado: OrdenTrabajoEstado;
  fechaCierre: Date | null;
  createdAt: Date;
}

export interface TicketResumenDto {
  id: string;
  codigo: string;
  titulo: string;
  estado: TicketEstado;
  prioridad: Prioridad;
  otId: string;
  createdAt: Date;
}

export interface EquipoResumenDto {
  equipo: {
    id: string;
    codigo: string;
    nombre: string;
    tipo: string | null;
    marca: string | null;
    modelo: string | null;
    numeroSerie: string | null;
    ubicacion: string | null;
    estadoOperativo: EquipoEstadoOperativo;
    fechaInstalacion: Date | null;
    fechaCompra: Date | null;
    qrToken: string | null;
    activo: boolean;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
  estadisticas: EquipoEstadisticasDto;
  ultimasOrdenes: OrdenResumenDto[];
  ultimosTickets: TicketResumenDto[];
  // Programaciones de mantenimiento: se completa en Fase 4 (calendario).
  // Se expone desde ya para que el frontend pueda consumir la forma final.
  proximasProgramaciones: unknown[];
  alertas: EquipoAlertaDto[];
}
