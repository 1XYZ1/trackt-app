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
import { CreateOrdenDto } from './dto/create-orden.dto';
import { UpdateOrdenDto } from './dto/update-orden.dto';
import { ListOrdenesQueryDto } from './dto/list-ordenes-query.dto';

const LIST_SELECT = {
  id: true,
  codigo: true,
  equipoId: true,
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

// Tickets que cuentan como "cerrado" para detectar cierre automático de OT.
const TICKET_ESTADOS_CERRADO: TicketEstado[] = [TicketEstado.CERRADO];

@Injectable()
export class OrdenesService {
  constructor(private readonly prisma: PrismaService) {}

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

    const year = new Date().getUTCFullYear();
    const lockKey = `ot:${tenantId}:${year}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<unknown>`
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      `;

      const codigo = await this.nextCodigo(tx, tenantId, year);

      return tx.ordenTrabajo.create({
        data: {
          tenantId,
          codigo,
          equipoId: dto.equipoId,
          descripcion: dto.descripcion,
          prioridad: dto.prioridad ?? Prioridad.MEDIA,
          estado: OrdenTrabajoEstado.PENDIENTE,
          creadoPorId: userId,
        },
        select: LIST_SELECT,
      });
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
    return ot;
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
   * - Cancela tickets asociados que estén en PENDIENTE (no toca los demás).
   * - Setea fechaCierre.
   */
  async cancelar(tenantId: string, id: string) {
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

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.ordenTrabajo.update({
        where: { id },
        data: {
          estado: OrdenTrabajoEstado.CANCELADA,
          fechaCierre: now,
        },
        select: LIST_SELECT,
      }),
      this.prisma.ticket.updateMany({
        where: {
          otId: id,
          tenantId,
          estado: { in: TICKET_ESTADOS_CANCELABLES },
        },
        data: {
          estado: TicketEstado.CANCELADO,
          fechaCierre: now,
        },
      }),
    ]);

    return updated;
  }

  // ---------- Hooks de integración con tickets ----------

  /**
   * Llamar desde TicketsService cuando se crea un ticket asociado a una OT.
   * Si la OT está PENDIENTE, transiciona a EN_PROCESO.
   * No-op si ya está EN_PROCESO/CERRADA/CANCELADA.
   */
  async onTicketCreated(tenantId: string, otId: string): Promise<void> {
    await this.prisma.ordenTrabajo.updateMany({
      where: {
        id: otId,
        tenantId,
        estado: OrdenTrabajoEstado.PENDIENTE,
      },
      data: { estado: OrdenTrabajoEstado.EN_PROCESO },
    });
  }

  /**
   * Llamar desde TicketsService cuando un ticket cambia de estado.
   * Si la OT está EN_PROCESO y *todos* sus tickets están CERRADOS,
   * transiciona la OT a CERRADA.
   */
  async onTicketEstadoCambiado(tenantId: string, otId: string): Promise<void> {
    const ot = await this.prisma.ordenTrabajo.findFirst({
      where: { id: otId, tenantId },
      select: { id: true, estado: true },
    });
    if (!ot || ot.estado !== OrdenTrabajoEstado.EN_PROCESO) {
      return;
    }

    const totalTickets = await this.prisma.ticket.count({
      where: { otId, tenantId },
    });
    if (totalTickets === 0) {
      return;
    }

    const cerrados = await this.prisma.ticket.count({
      where: {
        otId,
        tenantId,
        estado: { in: TICKET_ESTADOS_CERRADO },
      },
    });
    if (cerrados === totalTickets) {
      await this.prisma.ordenTrabajo.update({
        where: { id: otId },
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
}
