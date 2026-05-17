import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  OrdenTrabajoEstado,
  Prioridad,
  Prisma,
  TicketEstado,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResult,
  getPrismaSkip,
  PaginatedResult,
} from '../common/utils/pagination';
import { OrdenesService } from '../ordenes/ordenes.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { AsignarTicketDto } from './dto/asignar-ticket.dto';
import { FinalizarTicketDto } from './dto/finalizar-ticket.dto';
import { ValidarTicketDto } from './dto/validar-ticket.dto';
import { CerrarTicketDto } from './dto/cerrar-ticket.dto';
import { TicketResponseDto, UsuarioResumenDto } from './dto/ticket-response.dto';
import {
  TICKET_DETAIL_INCLUDE,
  TICKET_LIST_INCLUDE,
  collectUserIds,
  mapTicketDetail,
  mapTicketListItem,
} from './mappers/ticket.mapper';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OrdenesService))
    private readonly ordenesService: OrdenesService,
  ) {}

  /**
   * Crear ticket asociado a una OT.
   * - Ticket nace en estado PENDIENTE.
   * - Código único TKT-YYYY-NNNN calculado bajo advisory lock por tenant/año.
   * - Si la OT padre está en PENDIENTE, transiciona a EN_PROCESO en la misma
   *   transacción (atomicidad: o se crea todo, o nada).
   * - Crea el evento inicial del ticket (estadoAnterior=null → PENDIENTE).
   */
  async createFromOrden(
    tenantId: string,
    userId: string,
    otId: string,
    dto: CreateTicketDto,
  ): Promise<TicketResponseDto> {
    const ot = await this.prisma.ordenTrabajo.findFirst({
      where: { id: otId, tenantId },
      select: { id: true, estado: true },
    });
    if (!ot) {
      throw new NotFoundException(`Orden con id "${otId}" no encontrada`);
    }
    if (
      ot.estado === OrdenTrabajoEstado.CERRADA ||
      ot.estado === OrdenTrabajoEstado.CANCELADA
    ) {
      throw new ConflictException(
        `No se puede crear ticket sobre una OT en estado ${ot.estado}`,
      );
    }

    const year = new Date().getUTCFullYear();
    const lockKey = `ticket:${tenantId}:${year}`;

    const ticketRow = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<unknown>`
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      // Re-leer la OT dentro de la TX para cerrar la ventana de carrera
      // entre la validación inicial y la creación del ticket. Si entre medio
      // la OT fue cancelada/cerrada, abortamos antes de crear nada.
      const otFresh = await tx.ordenTrabajo.findFirst({
        where: { id: otId, tenantId },
        select: { id: true, estado: true },
      });
      if (!otFresh) {
        throw new NotFoundException(`Orden con id "${otId}" no encontrada`);
      }
      if (
        otFresh.estado === OrdenTrabajoEstado.CERRADA ||
        otFresh.estado === OrdenTrabajoEstado.CANCELADA
      ) {
        throw new ConflictException(
          `No se puede crear ticket sobre una OT en estado ${otFresh.estado}`,
        );
      }

      const codigo = await this.nextCodigo(tx, tenantId, year);

      const ticket = await tx.ticket.create({
        data: {
          tenantId,
          otId,
          codigo,
          titulo: dto.titulo,
          descripcion: dto.descripcion,
          prioridad: dto.prioridad ?? Prioridad.MEDIA,
          estado: TicketEstado.PENDIENTE,
          jefeId: userId,
        },
      });

      await tx.eventoEstadoTicket.create({
        data: {
          ticketId: ticket.id,
          estadoAnterior: null,
          estadoNuevo: TicketEstado.PENDIENTE,
          usuarioId: userId,
          observacion: 'Ticket creado',
        },
      });

      if (otFresh.estado === OrdenTrabajoEstado.PENDIENTE) {
        const result = await tx.ordenTrabajo.updateMany({
          where: {
            id: otId,
            tenantId,
            estado: OrdenTrabajoEstado.PENDIENTE,
          },
          data: { estado: OrdenTrabajoEstado.EN_PROCESO },
        });
        // Si entre el re-read y este updateMany otro endpoint mutó la OT
        // (ej. cancelar concurrente), count será 0 → abortar para no dejar
        // ticket EN_PROCESO con OT en estado incoherente.
        if (result.count !== 1) {
          throw new ConflictException(
            `OT ${otId} mutó concurrentemente — no se pudo transicionar a EN_PROCESO`,
          );
        }
      }

      return tx.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
        include: TICKET_DETAIL_INCLUDE,
      });
    });

    const users = await this.fetchUserSummaries(collectUserIds([ticketRow]));
    return mapTicketDetail(ticketRow, users);
  }

  async findAll(
    tenantId: string,
    query: ListTicketsQueryDto,
  ): Promise<PaginatedResult<TicketResponseDto>> {
    const { page = 1, limit = 10, estado, mecanicoId, otId } = query;

    const where: Prisma.TicketWhereInput = {
      tenantId,
      ...(estado && { estado }),
      ...(mecanicoId && { mecanicoId }),
      ...(otId && { otId }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: TICKET_LIST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: getPrismaSkip(page, limit),
        take: limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    const users = await this.fetchUserSummaries(collectUserIds(rows));
    const data = rows.map((row) => mapTicketListItem(row, users));
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(tenantId: string, id: string): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId },
      include: TICKET_DETAIL_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket con id "${id}" no encontrado`);
    }
    const users = await this.fetchUserSummaries(collectUserIds([ticket]));
    return mapTicketDetail(ticket, users);
  }

  // ---------- Transiciones de estado (TRA-27) ----------

  /**
   * Asignar mecánico a ticket. Solo admin. PENDIENTE → ASIGNADO.
   */
  async asignar(
    tenantId: string,
    userId: string,
    ticketId: string,
    dto: AsignarTicketDto,
  ): Promise<TicketResponseDto> {
    const ticket = await this.requireTicket(tenantId, ticketId);
    if (ticket.estado !== TicketEstado.PENDIENTE) {
      throw new ConflictException(
        `Solo se puede asignar un ticket en estado PENDIENTE (actual: ${ticket.estado})`,
      );
    }

    const mecanico = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id::text AS id
      FROM public.profiles
      WHERE id = ${dto.mecanicoId}::uuid
        AND tenant_id = ${tenantId}
        AND role = 'mechanic'::user_role
      LIMIT 1
    `;
    if (mecanico.length === 0) {
      throw new NotFoundException(
        `Mecánico "${dto.mecanicoId}" no encontrado en el tenant`,
      );
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          estado: TicketEstado.ASIGNADO,
          mecanicoId: dto.mecanicoId,
          jefeId: ticket.jefeId ?? userId,
          fechaAsignacion: now,
        },
      });
      await this.recordEvento(
        tx,
        ticketId,
        ticket.estado,
        TicketEstado.ASIGNADO,
        userId,
        'Asignado a mecánico',
      );
      return this.buildResponse(tx, ticketId);
    });
  }

  /**
   * Iniciar ejecución. Solo el mecánico asignado. ASIGNADO → EN_EJECUCION.
   */
  async iniciar(
    tenantId: string,
    userId: string,
    ticketId: string,
  ): Promise<TicketResponseDto> {
    const ticket = await this.requireTicket(tenantId, ticketId);
    if (ticket.estado !== TicketEstado.ASIGNADO) {
      throw new ConflictException(
        `Solo se puede iniciar un ticket en estado ASIGNADO (actual: ${ticket.estado})`,
      );
    }
    if (ticket.mecanicoId !== userId) {
      throw new ForbiddenException(
        'Solo el mecánico asignado puede iniciar el ticket',
      );
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          estado: TicketEstado.EN_EJECUCION,
          fechaInicioEjecucion: now,
        },
      });
      await this.recordEvento(
        tx,
        ticketId,
        ticket.estado,
        TicketEstado.EN_EJECUCION,
        userId,
        'Inicio de ejecución',
      );
      return this.buildResponse(tx, ticketId);
    });
  }

  /**
   * Finalizar ejecución. Solo el mecánico asignado. EN_EJECUCION → EJECUTADO.
   */
  async finalizar(
    tenantId: string,
    userId: string,
    ticketId: string,
    dto: FinalizarTicketDto,
  ): Promise<TicketResponseDto> {
    const ticket = await this.requireTicket(tenantId, ticketId);
    if (ticket.estado !== TicketEstado.EN_EJECUCION) {
      throw new ConflictException(
        `Solo se puede finalizar un ticket en estado EN_EJECUCION (actual: ${ticket.estado})`,
      );
    }
    if (ticket.mecanicoId !== userId) {
      throw new ForbiddenException(
        'Solo el mecánico asignado puede finalizar el ticket',
      );
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          estado: TicketEstado.EJECUTADO,
          fechaFinEjecucion: now,
        },
      });
      await this.recordEvento(
        tx,
        ticketId,
        ticket.estado,
        TicketEstado.EJECUTADO,
        userId,
        dto.observacion ?? 'Ejecución finalizada',
      );
      return this.buildResponse(tx, ticketId);
    });
  }

  /**
   * Validar ticket EJECUTADO. Solo admin.
   * - aprobado=true  → CERRADO + cascada OT (puede cerrar la OT).
   * - aprobado=false → vuelve a EN_EJECUCION (re-trabajo); limpia fechaFinEjecucion.
   */
  async validar(
    tenantId: string,
    userId: string,
    ticketId: string,
    dto: ValidarTicketDto,
  ): Promise<TicketResponseDto> {
    const ticket = await this.requireTicket(tenantId, ticketId);
    if (ticket.estado !== TicketEstado.EJECUTADO) {
      throw new ConflictException(
        `Solo se puede validar un ticket en estado EJECUTADO (actual: ${ticket.estado})`,
      );
    }

    const now = new Date();
    const nuevoEstado = dto.aprobado
      ? TicketEstado.CERRADO
      : TicketEstado.EN_EJECUCION;

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: dto.aprobado
          ? {
              estado: TicketEstado.CERRADO,
              fechaValidacion: now,
              fechaCierre: now,
            }
          : {
              estado: TicketEstado.EN_EJECUCION,
              fechaFinEjecucion: null,
              fechaValidacion: now,
            },
      });
      await this.recordEvento(
        tx,
        ticketId,
        ticket.estado,
        nuevoEstado,
        userId,
        dto.observacion ??
          (dto.aprobado ? 'Validado y cerrado' : 'Rechazado, vuelve a ejecución'),
      );
    });

    if (dto.aprobado) {
      await this.ordenesService.onTicketEstadoCambiado(tenantId, ticket.otId);
    }

    return this.findOne(tenantId, ticketId);
  }

  /**
   * Cierre formal del ticket (TRA-27). Solo admin.
   * Cubre el caso "validar y aprobar" y también cierres administrativos
   * forzados desde EJECUTADO. Si el ticket está en otro estado, falla.
   */
  async cerrar(
    tenantId: string,
    userId: string,
    ticketId: string,
    dto: CerrarTicketDto,
  ): Promise<TicketResponseDto> {
    const ticket = await this.requireTicket(tenantId, ticketId);
    if (ticket.estado !== TicketEstado.EJECUTADO) {
      throw new ConflictException(
        `Solo se puede cerrar un ticket en estado EJECUTADO (actual: ${ticket.estado})`,
      );
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          estado: TicketEstado.CERRADO,
          fechaValidacion: ticket.fechaValidacion ?? now,
          fechaCierre: now,
        },
      });
      await this.recordEvento(
        tx,
        ticketId,
        ticket.estado,
        TicketEstado.CERRADO,
        userId,
        dto.observacion ?? 'Cierre formal',
      );
    });

    await this.ordenesService.onTicketEstadoCambiado(tenantId, ticket.otId);

    return this.findOne(tenantId, ticketId);
  }

  // ---------- Helpers privados ----------

  private async requireTicket(tenantId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: {
        id: true,
        estado: true,
        otId: true,
        mecanicoId: true,
        jefeId: true,
        fechaValidacion: true,
      },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket "${ticketId}" no encontrado`);
    }
    return ticket;
  }

  private async recordEvento(
    tx: Prisma.TransactionClient,
    ticketId: string,
    estadoAnterior: TicketEstado,
    estadoNuevo: TicketEstado,
    usuarioId: string,
    observacion?: string,
  ): Promise<void> {
    await tx.eventoEstadoTicket.create({
      data: {
        ticketId,
        estadoAnterior,
        estadoNuevo,
        usuarioId,
        observacion,
      },
    });
  }

  private async buildResponse(
    tx: Prisma.TransactionClient,
    ticketId: string,
  ): Promise<TicketResponseDto> {
    const row = await tx.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: TICKET_DETAIL_INCLUDE,
    });
    const users = await this.fetchUserSummaries(collectUserIds([row]));
    return mapTicketDetail(row, users);
  }

  /**
   * Calcula el siguiente código TKT-YYYY-NNNN para un tenant/año.
   * Asume estar dentro de la transacción con el advisory lock ya tomado.
   * Solo considera códigos que matcheen el formato TKT-YYYY-...
   *
   * LIMITACIÓN: ordenamiento lexicográfico funciona hasta 9999 tickets/año
   * (padStart 4 mantiene ancho fijo). Si un tenant supera ese volumen anual,
   * migrar a $queryRaw con parse explícito a int del suffix.
   */
  private async nextCodigo(
    tx: Prisma.TransactionClient,
    tenantId: string,
    year: number,
  ): Promise<string> {
    const prefix = `TKT-${year}-`;
    const last = await tx.ticket.findFirst({
      where: { tenantId, codigo: { startsWith: prefix } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });

    let nextSeq = 1;
    if (last) {
      const suffix = last.codigo.slice(prefix.length);
      const parsed = parseInt(suffix, 10);
      if (!Number.isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  /**
   * Batch fetch de resúmenes de usuario desde `public.profiles`.
   * Patrón consistente con `auth/profile.service.ts` que también queriea
   * profiles vía $queryRaw (la tabla no está modelada en prisma/schema.prisma).
   *
   * Email + avatarUrl viven en `auth.users` (managed by Supabase) — requieren
   * admin API y se omiten por ahora. Frontend los maneja como opcionales.
   */
  private async fetchUserSummaries(
    userIds: string[],
  ): Promise<Map<string, UsuarioResumenDto>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; full_name: string | null }>
    >`
      SELECT id::text AS id, full_name
      FROM public.profiles
      WHERE id = ANY(${userIds}::uuid[])
    `;
    return new Map(
      rows.map((r) => [r.id, { id: r.id, nombre: r.full_name }]),
    );
  }
}
