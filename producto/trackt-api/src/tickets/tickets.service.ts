import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  NotificacionTipo,
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
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { OrdenesService } from '../ordenes/ordenes.service';
import { AuthUser } from '../auth/types';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { AsignarTicketDto } from './dto/asignar-ticket.dto';
import { ReasignarTicketDto } from './dto/reasignar-ticket.dto';
import { FinalizarTicketDto } from './dto/finalizar-ticket.dto';
import { ValidarTicketDto } from './dto/validar-ticket.dto';
import { CerrarTicketDto } from './dto/cerrar-ticket.dto';
import { CargaMecanicoDto } from './dto/carga-mecanicos-response.dto';
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
    private readonly notificaciones: NotificacionesService,
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
      // $executeRaw en vez de $queryRaw: pg_advisory_xact_lock retorna void
      // y $queryRaw intenta deserializar la columna → P2010.
      await tx.$executeRaw`
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

  /**
   * Lista tickets del tenant con scoping por rol:
   * - admin / jefe_taller: ven todos los tickets del tenant.
   * - mechanic: solo tickets donde es el mecánico asignado.
   *
   * El filtro por rol se fuerza a nivel backend (no depende de RLS) porque
   * NestJS conecta como service role y bypassa policies.
   */
  async findAll(
    tenantId: string,
    user: AuthUser,
    query: ListTicketsQueryDto,
  ): Promise<PaginatedResult<TicketResponseDto>> {
    const { page = 1, limit = 10, estado, mecanicoId, otId } = query;

    const where: Prisma.TicketWhereInput = {
      tenantId,
      ...(estado && { estado }),
      ...(otId && { otId }),
      // mechanic queda forzado a sus propios tickets, ignorando lo que pida el query.
      ...(user.role === 'mechanic'
        ? { mecanicoId: user.id }
        : mecanicoId
          ? { mecanicoId }
          : {}),
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

  /**
   * Detalle de ticket.
   * - admin / jefe_taller: cualquier ticket del tenant.
   * - mechanic: solo si está asignado al ticket.
   */
  async findOne(
    tenantId: string,
    user: AuthUser,
    id: string,
  ): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id, tenantId },
      include: TICKET_DETAIL_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket con id "${id}" no encontrado`);
    }
    if (user.role === 'mechanic' && ticket.mecanicoId !== user.id) {
      // Mismo mensaje que NotFound para no filtrar existencia.
      throw new NotFoundException(`Ticket con id "${id}" no encontrado`);
    }
    const users = await this.fetchUserSummaries(collectUserIds([ticket]));
    return mapTicketDetail(ticket, users);
  }

  /**
   * Versión interna sin filtro por rol. Usada por las transiciones de estado,
   * que ya verificaron permisos antes (via @Roles + lógica de service).
   */
  private async loadTicketResponse(
    tenantId: string,
    ticketId: string,
  ): Promise<TicketResponseDto> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: TICKET_DETAIL_INCLUDE,
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket con id "${ticketId}" no encontrado`);
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
    await this.prisma.$transaction(async (tx) => {
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
    });
    await this.notificaciones.emit(
      tenantId,
      dto.mecanicoId,
      NotificacionTipo.TICKET_ASIGNADO,
      {
        ticketId: ticket.id,
        ticketCodigo: ticket.codigo,
        ticketTitulo: ticket.titulo,
        ordenId: ticket.otId,
        actor: { id: userId },
        mensaje: `Te asignaron el ticket ${ticket.codigo}`,
      },
    );
    return this.loadTicketResponse(tenantId, ticketId);
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
    await this.prisma.$transaction(async (tx) => {
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
    });
    if (ticket.jefeId) {
      await this.notificaciones.emit(
        tenantId,
        ticket.jefeId,
        NotificacionTipo.TICKET_INICIADO,
        {
          ticketId: ticket.id,
          ticketCodigo: ticket.codigo,
          ticketTitulo: ticket.titulo,
          ordenId: ticket.otId,
          actor: { id: userId },
          mensaje: `El mecánico inició ${ticket.codigo}`,
        },
      );
    }
    return this.loadTicketResponse(tenantId, ticketId);
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
    await this.prisma.$transaction(async (tx) => {
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
    });
    if (ticket.jefeId) {
      await this.notificaciones.emit(
        tenantId,
        ticket.jefeId,
        NotificacionTipo.TICKET_FINALIZADO,
        {
          ticketId: ticket.id,
          ticketCodigo: ticket.codigo,
          ticketTitulo: ticket.titulo,
          ordenId: ticket.otId,
          actor: { id: userId },
          mensaje: `${ticket.codigo} listo para validar`,
        },
      );
    }
    return this.loadTicketResponse(tenantId, ticketId);
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

    if (ticket.mecanicoId) {
      await this.notificaciones.emit(
        tenantId,
        ticket.mecanicoId,
        dto.aprobado
          ? NotificacionTipo.TICKET_VALIDADO
          : NotificacionTipo.TICKET_RECHAZADO,
        {
          ticketId: ticket.id,
          ticketCodigo: ticket.codigo,
          ticketTitulo: ticket.titulo,
          ordenId: ticket.otId,
          actor: { id: userId },
          observacion: dto.observacion,
          mensaje: dto.aprobado
            ? `${ticket.codigo} validado y cerrado`
            : `${ticket.codigo} rechazado: revisa los comentarios`,
        },
      );
    }

    return this.loadTicketResponse(tenantId, ticketId);
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

    if (ticket.mecanicoId) {
      await this.notificaciones.emit(
        tenantId,
        ticket.mecanicoId,
        NotificacionTipo.TICKET_CERRADO,
        {
          ticketId: ticket.id,
          ticketCodigo: ticket.codigo,
          ticketTitulo: ticket.titulo,
          ordenId: ticket.otId,
          actor: { id: userId },
          observacion: dto.observacion,
          mensaje: `${ticket.codigo} cerrado`,
        },
      );
    }

    return this.loadTicketResponse(tenantId, ticketId);
  }

  // ---------- Gestión operativa (jefe_taller / admin) ----------

  /**
   * Reasignar ticket a otro mecánico.
   * - Roles: admin, jefe_taller (validado por @Roles en el controller).
   * - Estados permitidos: ASIGNADO, EN_EJECUCION.
   * - Estados bloqueados: PENDIENTE (usar `asignar`), EJECUTADO, CERRADO, CANCELADO.
   * - Motivo obligatorio cuando el ticket está EN_EJECUCION (impacto operativo).
   * - Registra evento con metadata (mecánico anterior/nuevo, motivo) para
   *   trazabilidad sin necesidad de nueva tabla.
   * - Si el nuevo mecánico es el mismo que el actual, falla con 409.
   */
  async reasignar(
    tenantId: string,
    userId: string,
    ticketId: string,
    dto: ReasignarTicketDto,
  ): Promise<TicketResponseDto> {
    const ticket = await this.requireTicket(tenantId, ticketId);

    const reasignables: TicketEstado[] = [
      TicketEstado.ASIGNADO,
      TicketEstado.EN_EJECUCION,
    ];
    if (!reasignables.includes(ticket.estado)) {
      throw new ConflictException(
        `No se puede reasignar un ticket en estado ${ticket.estado}`,
      );
    }

    const motivo = dto.motivo?.trim();
    if (ticket.estado === TicketEstado.EN_EJECUCION && !motivo) {
      throw new BadRequestException(
        'El motivo es obligatorio para reasignar un ticket EN_EJECUCION',
      );
    }

    if (ticket.mecanicoId === dto.mecanicoId) {
      throw new ConflictException(
        'El ticket ya está asignado a ese mecánico',
      );
    }

    // Validar que el nuevo mecánico exista en el tenant y tenga rol mechanic.
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

    const mecanicoAnteriorId = ticket.mecanicoId;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          mecanicoId: dto.mecanicoId,
          // Si vuelve a ASIGNADO desde EN_EJECUCION, limpiar fechaInicio.
          ...(ticket.estado === TicketEstado.EN_EJECUCION && {
            estado: TicketEstado.ASIGNADO,
            fechaInicioEjecucion: null,
          }),
          fechaAsignacion: now,
        },
      });
      // Evento de reasignación: usamos estadoAnterior=ASIGNADO/EN_EJECUCION y
      // estadoNuevo=ASIGNADO; el detalle (mecánico previo/nuevo/motivo) va en
      // observacion + metadata para trazabilidad sin nuevas columnas.
      const observacion =
        `Reasignado de ${mecanicoAnteriorId ?? 'sin mecánico'} a ${dto.mecanicoId}` +
        (motivo ? ` — Motivo: ${motivo}` : '');
      await tx.eventoEstadoTicket.create({
        data: {
          ticketId,
          estadoAnterior: ticket.estado,
          estadoNuevo: TicketEstado.ASIGNADO,
          usuarioId: userId,
          observacion,
          metadata: {
            tipo: 'REASIGNACION',
            mecanicoAnteriorId,
            mecanicoNuevoId: dto.mecanicoId,
            motivo: motivo ?? null,
          },
        },
      });
    });

    // Notificar al nuevo mecánico (reutiliza el tipo TICKET_ASIGNADO; no
    // agregamos un tipo nuevo para no expandir el enum NotificacionTipo).
    await this.notificaciones.emit(
      tenantId,
      dto.mecanicoId,
      NotificacionTipo.TICKET_ASIGNADO,
      {
        ticketId: ticket.id,
        ticketCodigo: ticket.codigo,
        ticketTitulo: ticket.titulo,
        ordenId: ticket.otId,
        actor: { id: userId },
        observacion: motivo,
        mensaje: `Te reasignaron el ticket ${ticket.codigo}`,
      },
    );

    // Notificar al mecánico anterior (si existía) para que sepa que perdió el
    // ticket. Reutilizamos TICKET_ASIGNADO con un mensaje distinto en lugar de
    // agregar un nuevo tipo de enum.
    if (mecanicoAnteriorId && mecanicoAnteriorId !== dto.mecanicoId) {
      await this.notificaciones.emit(
        tenantId,
        mecanicoAnteriorId,
        NotificacionTipo.TICKET_ASIGNADO,
        {
          ticketId: ticket.id,
          ticketCodigo: ticket.codigo,
          ticketTitulo: ticket.titulo,
          ordenId: ticket.otId,
          actor: { id: userId },
          observacion: motivo,
          mensaje: `Se reasignó el ticket ${ticket.codigo} a otro mecánico`,
        },
      );
    }

    return this.loadTicketResponse(tenantId, ticketId);
  }

  /**
   * Carga de trabajo por mecánico del tenant.
   * - Roles: admin, jefe_taller (validado por @Roles en el controller).
   * - Devuelve solo perfiles con rol `mechanic` del tenant.
   * - Cuenta tickets abiertos por estado (excluye CERRADO y CANCELADO).
   * - Incluye mecánicos sin tickets (totalAbiertos = 0) para visibilidad.
   */
  async getCargaMecanicos(tenantId: string): Promise<CargaMecanicoDto[]> {
    interface MecanicoRow {
      id: string;
      full_name: string | null;
      email: string | null;
    }
    const mecanicos = await this.prisma.$queryRaw<MecanicoRow[]>`
      SELECT p.id::text AS id, p.full_name, u.email
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      WHERE p.tenant_id = ${tenantId}
        AND p.role = 'mechanic'::user_role
      ORDER BY p.full_name ASC NULLS LAST
    `;

    if (mecanicos.length === 0) return [];

    const ids = mecanicos.map((m) => m.id);
    const abiertos: TicketEstado[] = [
      TicketEstado.PENDIENTE,
      TicketEstado.ASIGNADO,
      TicketEstado.EN_EJECUCION,
      TicketEstado.EJECUTADO,
    ];

    const counts = await this.prisma.ticket.groupBy({
      by: ['mecanicoId', 'estado'],
      where: {
        tenantId,
        mecanicoId: { in: ids },
        estado: { in: abiertos },
      },
      _count: { _all: true },
    });

    const buckets = new Map<string, CargaMecanicoDto>();
    for (const m of mecanicos) {
      buckets.set(m.id, {
        mecanicoId: m.id,
        nombre: m.full_name,
        email: m.email,
        pendientes: 0,
        asignados: 0,
        enEjecucion: 0,
        ejecutados: 0,
        totalAbiertos: 0,
      });
    }

    for (const row of counts) {
      if (!row.mecanicoId) continue;
      const bucket = buckets.get(row.mecanicoId);
      if (!bucket) continue;
      const n = row._count._all;
      switch (row.estado) {
        case TicketEstado.PENDIENTE:
          bucket.pendientes += n;
          break;
        case TicketEstado.ASIGNADO:
          bucket.asignados += n;
          break;
        case TicketEstado.EN_EJECUCION:
          bucket.enEjecucion += n;
          break;
        case TicketEstado.EJECUTADO:
          bucket.ejecutados += n;
          break;
      }
      bucket.totalAbiertos += n;
    }

    return Array.from(buckets.values());
  }

  // ---------- Helpers privados ----------

  private async requireTicket(tenantId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: {
        id: true,
        codigo: true,
        titulo: true,
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
