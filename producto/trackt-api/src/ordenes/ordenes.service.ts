import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
import { siguienteCodigo } from '../common/utils/codigo.util';
import { InventarioService } from '../inventario/inventario.service';
import { ProfileService } from '../auth/profile.service';
import { CreateOrdenDto } from './dto/create-orden.dto';
import { UpdateOrdenDto } from './dto/update-orden.dto';
import { ListOrdenesQueryDto } from './dto/list-ordenes-query.dto';

const LIST_SELECT = {
  id: true,
  codigo: true,
  equipoId: true,
  // equipo + tickets para que el listado muestre el nombre del equipo y el
  // conteo de tickets (la UI consume orden.equipo y orden.tickets.length).
  equipo: {
    select: { id: true, codigo: true, nombre: true },
  },
  tickets: {
    select: { id: true },
  },
  descripcion: true,
  prioridad: true,
  estado: true,
  fechaCierre: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrdenTrabajoSelect;

const DETAIL_INCLUDE = {
  equipo: {
    select: { id: true, codigo: true, nombre: true },
  },
  tickets: {
    select: {
      id: true,
      codigo: true,
      titulo: true,
      estado: true,
      prioridad: true,
      mecanicoId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.OrdenTrabajoInclude;

// Tickets que no se cancelan en cascada cuando se cancela una OT.
// Solo se cancelan los que están en PENDIENTE.
const TICKET_ESTADOS_CANCELABLES: TicketEstado[] = [TicketEstado.PENDIENTE];

// Tickets "vivos" (trabajo en curso) que bloquean la cancelación de la OT:
// hay que cerrarlos o reasignarlos antes para no dejar trabajo contra una OT muerta.
const TICKET_ESTADOS_ACTIVOS: TicketEstado[] = [
  TicketEstado.ASIGNADO,
  TicketEstado.EN_EJECUCION,
  TicketEstado.EJECUTADO,
];

// Tickets que cuentan como "cerrado" para detectar cierre automático de OT.
const TICKET_ESTADOS_CERRADO: TicketEstado[] = [TicketEstado.CERRADO];

@Injectable()
export class OrdenesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventario: InventarioService,
    private readonly profiles: ProfileService,
  ) {}

  // ---------- CRUD ----------

  /**
   * Crear OT en estado PENDIENTE con código OT-YYYY-NNNN único por tenant/año.
   * La secuencia se calcula bajo transacción + advisory lock para evitar
   * colisiones bajo concurrencia (Postgres/Supabase).
   */
  async create(tenantId: string, userId: string, dto: CreateOrdenDto) {
    // Verificar que el equipo existe y pertenece al tenant antes de tomar lock
    const equipo = await this.prisma.equipo.findFirst({
      where: { id: dto.equipoId, tenantId },
      select: { id: true },
    });
    if (!equipo) {
      throw new NotFoundException(
        `Equipo con id "${dto.equipoId}" no encontrado`,
      );
    }

    return this.prisma.$transaction((tx) =>
      this.crearEnTx(tx, tenantId, userId, {
        equipoId: dto.equipoId,
        descripcion: dto.descripcion,
        prioridad: dto.prioridad,
      }),
    );
  }

  /**
   * Núcleo de creación de OT, ejecutable dentro de una transacción existente.
   * Lo usan create (endpoint) y la generación desde programaciones (Fase 5).
   * Toma el advisory lock de secuencia y calcula el código OT-YYYY-NNNN;
   * NO valida el equipo — responsabilidad del caller.
   */
  async crearEnTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    params: {
      equipoId: string;
      descripcion: string;
      prioridad?: Prioridad;
      metadata?: Record<string, unknown>;
    },
  ) {
    const year = new Date().getUTCFullYear();
    const lockKey = `ot:${tenantId}:${year}`;

    // $executeRaw en vez de $queryRaw: pg_advisory_xact_lock retorna void
    // y $queryRaw intenta deserializar la columna → P2010.
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    `;

    const codigo = await this.nextCodigo(tx, tenantId, year);

    return tx.ordenTrabajo.create({
      data: {
        tenantId,
        codigo,
        equipoId: params.equipoId,
        descripcion: params.descripcion,
        prioridad: params.prioridad ?? Prioridad.MEDIA,
        estado: OrdenTrabajoEstado.PENDIENTE,
        creadoPorId: userId,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
      select: LIST_SELECT,
    });
  }

  async findAll(
    tenantId: string,
    query: ListOrdenesQueryDto,
  ): Promise<
    PaginatedResult<
      Prisma.OrdenTrabajoGetPayload<{ select: typeof LIST_SELECT }>
    >
  > {
    const { page = 1, limit = 10, estado, equipoId } = query;

    const where: Prisma.OrdenTrabajoWhereInput = {
      tenantId,
      ...(estado && { estado }),
      ...(equipoId && { equipoId }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.ordenTrabajo.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: getPrismaSkip(page, limit),
        take: limit,
      }),
      this.prisma.ordenTrabajo.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    const ot = await this.prisma.ordenTrabajo.findFirst({
      where: { id, tenantId },
      include: DETAIL_INCLUDE,
    });
    if (!ot) {
      throw new NotFoundException(`Orden con id "${id}" no encontrada`);
    }

    // Hidratar nombres de usuario (responsable + mecánicos de los tickets) desde
    // public.profiles, y dar a cada ticket la forma que la UI consume
    // (equipo como string + objeto mecanico), derivando el equipo de la OT.
    const equipoLabel = ot.equipo
      ? `${ot.equipo.codigo} - ${ot.equipo.nombre}`
      : '';
    const userIds = [
      ot.creadoPorId,
      ...ot.tickets.map((t) => t.mecanicoId),
    ].filter((v): v is string => Boolean(v));
    const users = await this.profiles.getUserSummaries(userIds);

    return {
      ...ot,
      responsable: users.get(ot.creadoPorId) ?? { id: ot.creadoPorId },
      tickets: ot.tickets.map((t) => ({
        id: t.id,
        codigo: t.codigo,
        titulo: t.titulo,
        estado: t.estado,
        prioridad: t.prioridad,
        equipo: equipoLabel,
        mecanico: t.mecanicoId
          ? (users.get(t.mecanicoId) ?? { id: t.mecanicoId })
          : null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    };
  }

  /**
   * Actualizar descripción y/o prioridad. Solo permitido en estado PENDIENTE.
   */
  async update(tenantId: string, id: string, dto: UpdateOrdenDto) {
    const ot = await this.prisma.ordenTrabajo.findFirst({
      where: { id, tenantId },
      select: { id: true, estado: true },
    });
    if (!ot) {
      throw new NotFoundException(`Orden con id "${id}" no encontrada`);
    }
    if (ot.estado !== OrdenTrabajoEstado.PENDIENTE) {
      throw new ConflictException(
        `Solo se puede editar una OT en estado PENDIENTE (actual: ${ot.estado})`,
      );
    }

    if (dto.descripcion === undefined && dto.prioridad === undefined) {
      throw new BadRequestException(
        'Debe indicar al menos un campo (descripcion o prioridad)',
      );
    }

    return this.prisma.ordenTrabajo.update({
      where: { id },
      data: {
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.prioridad !== undefined && { prioridad: dto.prioridad }),
      },
      select: LIST_SELECT,
    });
  }

  /**
   * Cancelar OT.
   * - Permitido desde PENDIENTE o EN_PROCESO.
   * - Bloquea la cancelación si hay tickets activos (ASIGNADO/EN_EJECUCION/
   *   EJECUTADO): deben cerrarse o reasignarse antes, para no dejar trabajo vivo
   *   contra una OT cancelada.
   * - Cancela en cascada los tickets PENDIENTE y libera sus reservas activas.
   * - Setea fechaCierre.
   */
  async cancelar(tenantId: string, userId: string, id: string) {
    const ot = await this.prisma.ordenTrabajo.findFirst({
      where: { id, tenantId },
      select: { id: true, estado: true },
    });
    if (!ot) {
      throw new NotFoundException(`Orden con id "${id}" no encontrada`);
    }
    if (
      ot.estado !== OrdenTrabajoEstado.PENDIENTE &&
      ot.estado !== OrdenTrabajoEstado.EN_PROCESO
    ) {
      throw new ConflictException(
        `No se puede cancelar una OT en estado ${ot.estado}`,
      );
    }

    const activos = await this.prisma.ticket.count({
      where: { otId: id, tenantId, estado: { in: TICKET_ESTADOS_ACTIVOS } },
    });
    if (activos > 0) {
      throw new ConflictException(
        `No se puede cancelar la OT: tiene ${activos} ticket(s) en progreso. Ciérralos o reasígnalos antes de cancelar.`,
      );
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const pendientes = await tx.ticket.findMany({
        where: {
          otId: id,
          tenantId,
          estado: { in: TICKET_ESTADOS_CANCELABLES },
        },
        select: { id: true },
      });

      const updated = await tx.ordenTrabajo.update({
        where: { id },
        data: {
          estado: OrdenTrabajoEstado.CANCELADA,
          fechaCierre: now,
        },
        select: LIST_SELECT,
      });

      if (pendientes.length > 0) {
        await tx.ticket.updateMany({
          where: {
            otId: id,
            tenantId,
            estado: { in: TICKET_ESTADOS_CANCELABLES },
          },
          data: { estado: TicketEstado.CANCELADO, fechaCierre: now },
        });
        // Devolver el stock reservado de cada ticket cancelado.
        for (const t of pendientes) {
          await this.inventario.liberarReservasDeTicket(
            tx,
            tenantId,
            t.id,
            userId,
          );
        }
      }

      return updated;
    });
  }

  // ---------- Hooks de integración con tickets ----------
  // (onTicketCreated se eliminó en la revisión integral: nadie lo invocaba —
  // la transición PENDIENTE → EN_PROCESO se hace inline y con guard dentro
  // de las tx de TicketsService.createFromOrden y generarOt.)

  /**
   * Llamar desde TicketsService cuando un ticket cambia de estado.
   * Si la OT está EN_PROCESO y *todos* sus tickets están CERRADOS,
   * transiciona la OT a CERRADA.
   *
   * Acepta un TransactionClient opcional: cuando se invoca desde el cierre de un
   * ticket se pasa la misma `tx` para que el cierre del ticket y el de la OT sean
   * atómicos (o ambos, o ninguno). Dentro de la tx toma un advisory lock por OT
   * y usa updateMany guardado por estado=EN_PROCESO (idempotente y a prueba de
   * carreras de doble cierre).
   */
  async onTicketEstadoCambiado(
    tenantId: string,
    otId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx ?? this.prisma;

    if (tx) {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${`ot:${tenantId}:${otId}`}, 0))
      `;
    }

    const ot = await db.ordenTrabajo.findFirst({
      where: { id: otId, tenantId },
      select: { id: true, estado: true },
    });
    if (!ot || ot.estado !== OrdenTrabajoEstado.EN_PROCESO) {
      return;
    }

    const totalTickets = await db.ticket.count({
      where: { otId, tenantId },
    });
    if (totalTickets === 0) {
      return;
    }

    const cerrados = await db.ticket.count({
      where: {
        otId,
        tenantId,
        estado: { in: TICKET_ESTADOS_CERRADO },
      },
    });
    if (cerrados === totalTickets) {
      await db.ordenTrabajo.updateMany({
        where: { id: otId, tenantId, estado: OrdenTrabajoEstado.EN_PROCESO },
        data: {
          estado: OrdenTrabajoEstado.CERRADA,
          fechaCierre: new Date(),
        },
      });
    }
  }

  // ---------- Helpers ----------

  /**
   * Calcula el siguiente código OT-YYYY-NNNN para un tenant/año.
   * Asume estar dentro de la transacción con el advisory lock ya tomado.
   * Solo considera códigos que matcheen el formato OT-YYYY-...; otros códigos
   * legados (ej. OT-1001 del seed) son ignorados.
   */
  private async nextCodigo(
    tx: Prisma.TransactionClient,
    tenantId: string,
    year: number,
  ): Promise<string> {
    const prefix = `OT-${year}-`;
    const last = await tx.ordenTrabajo.findFirst({
      where: { tenantId, codigo: { startsWith: prefix } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });
    return siguienteCodigo(prefix, last?.codigo ?? null);
  }
}
