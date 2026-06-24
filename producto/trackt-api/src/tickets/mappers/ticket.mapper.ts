import { Prisma } from '@prisma/client';
import {
  ChecklistPasoDto,
  EquipoResumenDto,
  TicketResponseDto,
  TicketTimelineEventDto,
  UsuarioResumenDto,
} from '../dto/ticket-response.dto';

export const OT_DETAIL_SELECT = {
  id: true,
  codigo: true,
  estado: true,
  equipoId: true,
  equipo: {
    select: {
      id: true,
      codigo: true,
      nombre: true,
      marca: true,
      modelo: true,
      ubicacion: true,
    },
  },
} satisfies Prisma.OrdenTrabajoSelect;

export const TICKET_LIST_INCLUDE = {
  ot: { select: OT_DETAIL_SELECT },
} satisfies Prisma.TicketInclude;

export const TICKET_DETAIL_INCLUDE = {
  ot: { select: OT_DETAIL_SELECT },
  eventos: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.TicketInclude;

export type TicketListRow = Prisma.TicketGetPayload<{
  include: typeof TICKET_LIST_INCLUDE;
}>;

export type TicketDetailRow = Prisma.TicketGetPayload<{
  include: typeof TICKET_DETAIL_INCLUDE;
}>;

type EquipoFromRow = NonNullable<TicketListRow['ot']>['equipo'];

function mapEquipo(equipo: EquipoFromRow): EquipoResumenDto | null {
  if (!equipo) return null;
  return {
    id: equipo.id,
    codigo: equipo.codigo,
    nombre: equipo.nombre,
    marca: equipo.marca,
    modelo: equipo.modelo,
    ubicacion: equipo.ubicacion,
  };
}

function deriveEquipoNombre(equipo: EquipoFromRow): string | null {
  if (!equipo) return null;
  return `${equipo.codigo} - ${equipo.nombre}`;
}

function resolveUsuario(
  userId: string | null | undefined,
  users: Map<string, UsuarioResumenDto>,
): UsuarioResumenDto | null {
  if (!userId) return null;
  return users.get(userId) ?? { id: userId };
}

/**
 * Lee Ticket.metadata.checklist de forma defensiva → [{ paso, hecho }].
 * Tolera metadata null/legacy y entradas malformadas (las descarta). El
 * checklist se materializa al generar/crear desde plantilla; tickets sin
 * receta devuelven [].
 */
export function readChecklist(
  metadata: Prisma.JsonValue | null | undefined,
): ChecklistPasoDto[] {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    !('checklist' in metadata)
  ) {
    return [];
  }
  const value = (metadata as { checklist?: unknown }).checklist;
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (e): e is { paso: string; hecho: boolean } =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as { paso?: unknown }).paso === 'string' &&
        typeof (e as { hecho?: unknown }).hecho === 'boolean',
    )
    .map((e) => ({ paso: e.paso, hecho: e.hecho }));
}

function baseTicketFields(
  ticket: TicketListRow,
  users: Map<string, UsuarioResumenDto>,
): Omit<TicketResponseDto, 'timeline'> {
  const equipo = ticket.ot?.equipo ?? null;
  return {
    id: ticket.id,
    codigo: ticket.codigo,
    titulo: ticket.titulo,
    descripcion: ticket.descripcion,
    estado: ticket.estado,
    prioridad: ticket.prioridad,
    ordenId: ticket.otId,
    ordenCodigo: ticket.ot?.codigo ?? null,
    equipo: mapEquipo(equipo),
    equipoNombre: deriveEquipoNombre(equipo),
    mecanico: resolveUsuario(ticket.mecanicoId, users),
    createdAt: ticket.createdAt.toISOString(),
    checklist: readChecklist(ticket.metadata),
  };
}

export function mapTicketListItem(
  ticket: TicketListRow,
  users: Map<string, UsuarioResumenDto>,
): TicketResponseDto {
  return baseTicketFields(ticket, users);
}

export function mapTicketDetail(
  ticket: TicketDetailRow,
  users: Map<string, UsuarioResumenDto>,
): TicketResponseDto {
  const timeline: TicketTimelineEventDto[] = ticket.eventos.map((e) => ({
    id: e.id,
    estadoAnterior: e.estadoAnterior,
    estadoNuevo: e.estadoNuevo,
    usuario: resolveUsuario(e.usuarioId, users),
    observacion: e.observacion,
    timestamp: e.createdAt.toISOString(),
  }));

  return {
    ...baseTicketFields(ticket, users),
    timeline,
  };
}

/**
 * Recolecta los IDs de usuarios referenciados por un ticket (mecánico) y sus
 * eventos timeline (usuarioId), para batch fetch de profiles.
 */
export function collectUserIds(
  tickets: (TicketListRow | TicketDetailRow)[],
): string[] {
  const ids = new Set<string>();
  for (const t of tickets) {
    if (t.mecanicoId) ids.add(t.mecanicoId);
    if (t.jefeId) ids.add(t.jefeId);
    if ('eventos' in t && Array.isArray(t.eventos)) {
      for (const e of t.eventos) {
        if (e.usuarioId) ids.add(e.usuarioId);
      }
    }
  }
  return Array.from(ids);
}
