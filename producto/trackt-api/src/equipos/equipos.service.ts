import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ListEquiposQueryDto } from './dto/list-equipos-query.dto';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { EquipoAlertaDto, EquipoResumenDto } from './dto/equipo-resumen.dto';
import {
  buildPaginatedResult,
  getPrismaSkip,
  PaginatedResult,
} from '../common/utils/pagination';
import {
  EquipoEstadoOperativo,
  OrdenTrabajoEstado,
  Prioridad,
  Prisma,
  ProgramacionMantenimientoEstado,
  ReservaRepuestoEstado,
  TicketEstado,
  MovimientoInventarioTipo,
} from '@prisma/client';

// Proyección pública para la lista (sin metadata ni timestamps)
const LIST_SELECT = {
  id: true,
  codigo: true,
  nombre: true,
  tipo: true,
  marca: true,
  modelo: true,
  ubicacion: true,
  estadoOperativo: true,
  activo: true,
} satisfies Prisma.EquipoSelect;

// Proyección completa para el detalle
const DETAIL_SELECT = {
  id: true,
  codigo: true,
  nombre: true,
  tipo: true,
  marca: true,
  modelo: true,
  numeroSerie: true,
  ubicacion: true,
  estadoOperativo: true,
  fechaInstalacion: true,
  fechaCompra: true,
  qrToken: true,
  activo: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EquipoSelect;

// OTs "abiertas" para estadísticas/alertas del resumen.
const OT_ESTADOS_ABIERTOS: OrdenTrabajoEstado[] = [
  OrdenTrabajoEstado.PENDIENTE,
  OrdenTrabajoEstado.EN_PROCESO,
];

// Tickets "activos" (trabajo no terminado) para el resumen.
const TICKET_ESTADOS_ACTIVOS: TicketEstado[] = [
  TicketEstado.PENDIENTE,
  TicketEstado.ASIGNADO,
  TicketEstado.EN_EJECUCION,
  TicketEstado.EJECUTADO,
];

// Reservas que retienen stock o esperan aprobación.
const RESERVA_ESTADOS_ACTIVOS: ReservaRepuestoEstado[] = [
  ReservaRepuestoEstado.SOLICITADA,
  ReservaRepuestoEstado.RESERVADA,
];

/**
 * Normalización de textos: evita duplicados inconsistentes por espacios o
 * mayúsculas/minúsculas ("eq-100 " vs "EQ-100").
 * - codigo: trim + UPPERCASE (el código es identificador de negocio).
 * - resto: trim. Strings que quedan vacíos se tratan como null (no guardar "").
 */
function normCodigo(value: string): string {
  return value.trim().toUpperCase();
}

/** Para campos opcionales en create: '' / espacios → null. */
function normOptional(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Para campos opcionales en update: preserva null explícito (= limpiar). */
function normNullable(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

@Injectable()
export class EquiposService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: ListEquiposQueryDto,
  ): Promise<
    PaginatedResult<Prisma.EquipoGetPayload<{ select: typeof LIST_SELECT }>>
  > {
    const { page = 1, limit = 10, search, includeInactive } = query;

    const where: Prisma.EquipoWhereInput = {
      tenantId,
      // Por defecto solo equipos activos. Si includeInactive=true, devolver todos.
      ...(includeInactive ? {} : { activo: true }),
      // Búsqueda por texto en múltiples campos (OR)
      ...(search && {
        OR: [
          { codigo: { contains: search, mode: 'insensitive' } },
          { nombre: { contains: search, mode: 'insensitive' } },
          { tipo: { contains: search, mode: 'insensitive' } },
          { marca: { contains: search, mode: 'insensitive' } },
          { modelo: { contains: search, mode: 'insensitive' } },
          { numeroSerie: { contains: search, mode: 'insensitive' } },
          { ubicacion: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.equipo.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { codigo: 'asc' }, // orden natural para selector
        skip: getPrismaSkip(page, limit),
        take: limit,
      }),
      this.prisma.equipo.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    const equipo = await this.prisma.equipo.findFirst({
      where: { id, tenantId }, // doble filtro: id + tenant (seguridad)
      select: DETAIL_SELECT,
    });

    if (!equipo) {
      // Mismo mensaje para id-no-existe y equipo-de-otro-tenant
      // (no revelar si el id existe en otro tenant)
      throw new NotFoundException(`Equipo con id "${id}" no encontrado`);
    }

    return equipo;
  }

  async create(tenantId: string, dto: CreateEquipoDto) {
    const codigo = normCodigo(dto.codigo);
    const nombre = dto.nombre.trim();
    // @IsNotEmpty no rechaza strings de solo espacios; se valida post-trim.
    if (!codigo || !nombre) {
      throw new BadRequestException(
        'codigo y nombre no pueden ser vacíos o solo espacios',
      );
    }

    // Validar duplicado de código antes de insertar para devolver 409 explícito.
    // La constraint @@unique([tenantId, codigo]) actúa como red de seguridad.
    const existing = await this.prisma.equipo.findUnique({
      where: { tenantId_codigo: { tenantId, codigo } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un equipo con codigo "${codigo}" en este tenant`,
      );
    }

    return this.prisma.equipo.create({
      data: {
        tenantId,
        codigo,
        nombre,
        tipo: normOptional(dto.tipo),
        marca: normOptional(dto.marca),
        modelo: normOptional(dto.modelo),
        numeroSerie: normOptional(dto.numeroSerie),
        ubicacion: normOptional(dto.ubicacion),
        ...(dto.estadoOperativo && { estadoOperativo: dto.estadoOperativo }),
        fechaInstalacion: dto.fechaInstalacion,
        fechaCompra: dto.fechaCompra,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        // activo se inicia en true por default a nivel BD.
      },
      select: DETAIL_SELECT,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateEquipoDto) {
    const equipo = await this.prisma.equipo.findFirst({
      where: { id, tenantId },
      select: { id: true, codigo: true },
    });
    if (!equipo) {
      throw new NotFoundException(`Equipo con id "${id}" no encontrado`);
    }

    const codigo =
      dto.codigo !== undefined ? normCodigo(dto.codigo) : undefined;
    const nombre = dto.nombre !== undefined ? dto.nombre.trim() : undefined;
    if (codigo === '' || nombre === '') {
      throw new BadRequestException(
        'codigo y nombre no pueden ser vacíos o solo espacios',
      );
    }

    // Si cambia el codigo (comparado ya normalizado), validar duplicados en el
    // mismo tenant. " eq-100 " sobre un equipo "EQ-100" no dispara el check.
    if (codigo !== undefined && codigo !== equipo.codigo) {
      const dup = await this.prisma.equipo.findUnique({
        where: { tenantId_codigo: { tenantId, codigo } },
        select: { id: true },
      });
      if (dup && dup.id !== id) {
        throw new ConflictException(
          `Ya existe un equipo con codigo "${codigo}" en este tenant`,
        );
      }
    }

    return this.prisma.equipo.update({
      where: { id },
      data: {
        ...(codigo !== undefined && { codigo }),
        ...(nombre !== undefined && { nombre }),
        ...(dto.tipo !== undefined && { tipo: normNullable(dto.tipo) }),
        ...(dto.marca !== undefined && { marca: normNullable(dto.marca) }),
        ...(dto.modelo !== undefined && { modelo: normNullable(dto.modelo) }),
        ...(dto.numeroSerie !== undefined && {
          numeroSerie: normNullable(dto.numeroSerie),
        }),
        ...(dto.ubicacion !== undefined && {
          ubicacion: normNullable(dto.ubicacion),
        }),
        ...(dto.estadoOperativo !== undefined && {
          estadoOperativo: dto.estadoOperativo,
        }),
        ...(dto.fechaInstalacion !== undefined && {
          fechaInstalacion: dto.fechaInstalacion,
        }),
        ...(dto.fechaCompra !== undefined && { fechaCompra: dto.fechaCompra }),
        ...(dto.metadata !== undefined && {
          metadata: dto.metadata as Prisma.InputJsonValue,
        }),
      },
      select: DETAIL_SELECT,
    });
  }

  /**
   * Baja lógica: setea activo=false. Idempotente.
   * No se hace hard delete para preservar la relación con OTs históricas.
   */
  async desactivar(tenantId: string, id: string) {
    const equipo = await this.prisma.equipo.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!equipo) {
      throw new NotFoundException(`Equipo con id "${id}" no encontrado`);
    }

    return this.prisma.equipo.update({
      where: { id },
      data: { activo: false },
      select: DETAIL_SELECT,
    });
  }

  // ---------- QR ----------

  /**
   * Genera (o regenera) el token QR del equipo. Regenerar invalida el token
   * anterior: cualquier QR impreso previamente deja de resolver.
   * El token es opaco (UUID v4): no codifica tenant ni id del equipo.
   */
  async generarQr(tenantId: string, id: string) {
    const equipo = await this.prisma.equipo.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!equipo) {
      throw new NotFoundException(`Equipo con id "${id}" no encontrado`);
    }

    return this.prisma.equipo.update({
      where: { id },
      data: { qrToken: randomUUID() },
      select: DETAIL_SELECT,
    });
  }

  /**
   * Resuelve un equipo a partir de su token QR.
   * Requiere autenticación y filtra por el tenant del usuario: un QR de otro
   * tenant responde 404 (mismo mensaje que token inexistente, sin filtrar
   * existencia). Si a futuro se necesita resolución pública (sin login),
   * exponer un endpoint separado con proyección mínima y rate-limit.
   */
  async findByQrToken(tenantId: string, qrToken: string) {
    const equipo = await this.prisma.equipo.findFirst({
      where: { qrToken, tenantId },
      select: DETAIL_SELECT,
    });
    if (!equipo) {
      throw new NotFoundException('Equipo no encontrado para el QR indicado');
    }
    return equipo;
  }

  // ---------- Resumen (ficha central del equipo) ----------

  /**
   * Ficha resumida del equipo: datos + estadísticas operativas + últimas
   * OTs/tickets + alertas derivadas.
   *
   * Decisiones:
   * - ordenesCerradas cuenta solo CERRADA (CANCELADA no es un cierre operativo).
   * - repuestosConsumidos = unidades consumidas (suma de movimientos CONSUMO,
   *   en valor absoluto: CONSUMO registra cantidad negativa).
   * - proximasProgramaciones: las 5 próximas PROGRAMADA desde hoy (Fase 4).
   */
  async resumen(tenantId: string, id: string): Promise<EquipoResumenDto> {
    const equipo = await this.prisma.equipo.findFirst({
      where: { id, tenantId },
      select: DETAIL_SELECT,
    });
    if (!equipo) {
      throw new NotFoundException(`Equipo con id "${id}" no encontrado`);
    }

    // Tickets/reservas/movimientos no tienen equipoId directo: se navega por
    // la relación ticket → ot → equipo, siempre dentro del tenant.
    const ticketsDelEquipo: Prisma.TicketWhereInput = {
      tenantId,
      ot: { equipoId: id },
    };

    // Próximas programaciones: solo PROGRAMADA desde hoy (inicio de día UTC,
    // para no esconder las de hoy por la hora).
    const desdeHoy = new Date();
    desdeHoy.setUTCHours(0, 0, 0, 0);

    const [
      ordenesAbiertas,
      ordenesCerradas,
      ticketsActivos,
      ticketsCerrados,
      reservasActivas,
      consumo,
      ultimasOrdenes,
      ultimosTickets,
      otsAltaAbiertas,
      proximasProgramaciones,
    ] = await this.prisma.$transaction([
      this.prisma.ordenTrabajo.count({
        where: {
          tenantId,
          equipoId: id,
          estado: { in: OT_ESTADOS_ABIERTOS },
        },
      }),
      this.prisma.ordenTrabajo.count({
        where: { tenantId, equipoId: id, estado: OrdenTrabajoEstado.CERRADA },
      }),
      this.prisma.ticket.count({
        where: { ...ticketsDelEquipo, estado: { in: TICKET_ESTADOS_ACTIVOS } },
      }),
      this.prisma.ticket.count({
        where: { ...ticketsDelEquipo, estado: TicketEstado.CERRADO },
      }),
      this.prisma.reservaRepuesto.count({
        where: {
          tenantId,
          estado: { in: RESERVA_ESTADOS_ACTIVOS },
          ticket: { ot: { equipoId: id } },
        },
      }),
      this.prisma.movimientoInventario.aggregate({
        _sum: { cantidad: true },
        where: {
          tenantId,
          tipo: MovimientoInventarioTipo.CONSUMO,
          ticket: { ot: { equipoId: id } },
        },
      }),
      this.prisma.ordenTrabajo.findMany({
        where: { tenantId, equipoId: id },
        select: {
          id: true,
          codigo: true,
          descripcion: true,
          prioridad: true,
          estado: true,
          fechaCierre: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.ticket.findMany({
        where: ticketsDelEquipo,
        select: {
          id: true,
          codigo: true,
          titulo: true,
          estado: true,
          prioridad: true,
          otId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.ordenTrabajo.count({
        where: {
          tenantId,
          equipoId: id,
          estado: { in: OT_ESTADOS_ABIERTOS },
          prioridad: Prioridad.ALTA,
        },
      }),
      this.prisma.programacionMantenimiento.findMany({
        where: {
          tenantId,
          equipoId: id,
          estado: ProgramacionMantenimientoEstado.PROGRAMADA,
          fechaProgramada: { gte: desdeHoy },
        },
        select: {
          id: true,
          titulo: true,
          fechaProgramada: true,
          estado: true,
          prioridad: true,
          plantilla: { select: { id: true, nombre: true } },
        },
        orderBy: { fechaProgramada: 'asc' },
        take: 5,
      }),
    ]);

    const alertas: EquipoAlertaDto[] = [];
    if (!equipo.activo) {
      alertas.push({
        tipo: 'EQUIPO_INACTIVO',
        mensaje: 'El equipo está dado de baja (inactivo)',
      });
    }
    if (equipo.estadoOperativo === EquipoEstadoOperativo.FUERA_DE_SERVICIO) {
      alertas.push({
        tipo: 'FUERA_DE_SERVICIO',
        mensaje: 'El equipo está fuera de servicio',
      });
    } else if (
      equipo.estadoOperativo === EquipoEstadoOperativo.EN_MANTENIMIENTO
    ) {
      alertas.push({
        tipo: 'EN_MANTENIMIENTO',
        mensaje: 'El equipo está en mantenimiento',
      });
    }
    if (otsAltaAbiertas > 0) {
      alertas.push({
        tipo: 'OT_PRIORIDAD_ALTA',
        mensaje: `Tiene ${otsAltaAbiertas} orden(es) de trabajo abiertas con prioridad ALTA`,
      });
    }

    return {
      equipo,
      estadisticas: {
        ordenesAbiertas,
        ordenesCerradas,
        ticketsActivos,
        ticketsCerrados,
        reservasActivas,
        // CONSUMO registra cantidades negativas; el resumen expone unidades.
        repuestosConsumidos: Math.abs(consumo._sum.cantidad ?? 0),
      },
      ultimasOrdenes,
      ultimosTickets,
      proximasProgramaciones,
      alertas,
    };
  }
}
