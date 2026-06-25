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
import { HistorialQueryDto } from './dto/historial-query.dto';
import {
  buildPaginatedResult,
  getPrismaSkip,
  PaginatedResult,
} from '../common/utils/pagination';
import {
  EquipoEstadoOperativo,
  MarcaTipo,
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
  marcaId: true,
  marcaRef: { select: { id: true, nombre: true } },
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
  marcaId: true,
  marcaRef: { select: { id: true, nombre: true } },
  tipoEquipoId: true,
  tipoEquipoRef: { select: { id: true, nombre: true } },
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

/**
 * Las relaciones al catálogo se seleccionan como `marcaRef`/`tipoEquipoRef`; al
 * cliente se exponen como `marca`/`tipoEquipo: { id, nombre } | null` (misma
 * forma que el repuesto). Espeja a `mapRepuesto` de InventarioService.
 * `tipoEquipoRef` es opcional en T: la lista (LIST_SELECT) no lo trae, por eso
 * `tipoEquipo` queda opcional en la salida.
 */
type EquipoConMarca<T> = Omit<T, 'marcaRef' | 'tipoEquipoRef'> & {
  marca: { id: string; nombre: string } | null;
  tipoEquipo?: { id: string; nombre: string } | null;
};

function mapEquipo<
  T extends {
    marcaRef: { id: string; nombre: string } | null;
    tipoEquipoRef?: { id: string; nombre: string } | null;
  },
>(equipo: T): EquipoConMarca<T> {
  const { marcaRef, tipoEquipoRef, ...rest } = equipo;
  return {
    ...rest,
    marca: marcaRef ? { id: marcaRef.id, nombre: marcaRef.nombre } : null,
    // Solo se agrega tipoEquipo si la proyección trajo la relación (detalle).
    ...(tipoEquipoRef !== undefined && {
      tipoEquipo: tipoEquipoRef
        ? { id: tipoEquipoRef.id, nombre: tipoEquipoRef.nombre }
        : null,
    }),
  } as EquipoConMarca<T>;
}

@Injectable()
export class EquiposService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: ListEquiposQueryDto,
  ): Promise<
    PaginatedResult<
      EquipoConMarca<Prisma.EquipoGetPayload<{ select: typeof LIST_SELECT }>>
    >
  > {
    const {
      page = 1,
      limit = 10,
      search,
      estadoOperativo,
      includeInactive,
    } = query;

    const where: Prisma.EquipoWhereInput = {
      tenantId,
      // Por defecto solo equipos activos. Si includeInactive=true, devolver todos.
      ...(includeInactive ? {} : { activo: true }),
      // Filtro por condición técnica (usa el índice tenant_id+estado_operativo).
      ...(estadoOperativo && { estadoOperativo }),
      // Búsqueda por texto en múltiples campos (OR)
      ...(search && {
        OR: [
          { codigo: { contains: search, mode: 'insensitive' } },
          { nombre: { contains: search, mode: 'insensitive' } },
          { tipo: { contains: search, mode: 'insensitive' } },
          // marca = texto legacy; marcaRef = nombre del catálogo (fuente actual).
          { marca: { contains: search, mode: 'insensitive' } },
          { marcaRef: { nombre: { contains: search, mode: 'insensitive' } } },
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

    return buildPaginatedResult(data.map(mapEquipo), total, page, limit);
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

    return mapEquipo(equipo);
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
    // Chequeo case-insensitive para evitar duplicados de facto ("EQ-1" vs "eq-1"):
    // el search de la lista es insensitive, así que se verían como el mismo.
    // La constraint @@unique([tenantId, codigo]) actúa como red de seguridad.
    // codigo ya viene normalizado (trim+UPPERCASE) → findUnique exacto es
    // suficiente. Se informa distinto si el duplicado está dado de baja.
    const existing = await this.prisma.equipo.findUnique({
      where: { tenantId_codigo: { tenantId, codigo } },
      select: { id: true, activo: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.activo
          ? `Ya existe un equipo con codigo "${codigo}" en este tenant`
          : `Existe un equipo desactivado con codigo "${codigo}". Reactívalo en vez de crear uno nuevo.`,
      );
    }

    // marcaId es opcional; si viene, debe ser una marca usable (existe, activa
    // y de ámbito EQUIPO/AMBOS). El escalar legacy `marca` no se escribe.
    const marcaId = normOptional(dto.marcaId);
    if (marcaId) {
      await this.assertMarcaUsable(tenantId, marcaId);
    }

    // tipoEquipoId es opcional; si viene, debe ser un tipo usable del tenant.
    // Sus repuestos default se autocopian a equipos_repuestos al crear.
    const tipoEquipoId = normOptional(dto.tipoEquipoId);
    if (tipoEquipoId) {
      await this.assertTipoEquipoUsable(tenantId, tipoEquipoId);
    }

    const data: Prisma.EquipoUncheckedCreateInput = {
      tenantId,
      codigo,
      nombre,
      tipo: normOptional(dto.tipo),
      marcaId,
      tipoEquipoId,
      modelo: normOptional(dto.modelo),
      numeroSerie: normOptional(dto.numeroSerie),
      ubicacion: normOptional(dto.ubicacion),
      ...(dto.estadoOperativo && { estadoOperativo: dto.estadoOperativo }),
      fechaInstalacion: dto.fechaInstalacion,
      fechaCompra: dto.fechaCompra,
      // El equipo nace con QR (token opaco UUID v4). POST /equipos/:id/qr lo
      // regenera bajo demanda.
      qrToken: randomUUID(),
      metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      // activo se inicia en true por default a nivel BD.
    };

    // Sin tipo: un solo insert. Con tipo: insert + copia de repuestos default
    // en la misma transacción (todo o nada).
    if (!tipoEquipoId) {
      const equipo = await this.prisma.equipo.create({
        data,
        select: DETAIL_SELECT,
      });
      return mapEquipo(equipo);
    }

    const equipo = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.equipo.create({ data, select: DETAIL_SELECT });

      // Repuestos default del tipo (mismo tenant) → repuestos habituales del
      // equipo. createMany con skipDuplicates: el equipo recién nace, pero el
      // guard es defensivo. `obligatorio` no tiene columna en EquipoRepuesto.
      const defaults = await tx.tipoEquipoRepuestoDefault.findMany({
        where: { tenantId, tipoEquipoId },
        select: { repuestoId: true, cantidadRef: true, observacion: true },
      });
      if (defaults.length > 0) {
        await tx.equipoRepuesto.createMany({
          data: defaults.map((d) => ({
            tenantId,
            equipoId: creado.id,
            repuestoId: d.repuestoId,
            cantidadRef: d.cantidadRef,
            observacion: d.observacion,
          })),
          skipDuplicates: true,
        });
      }

      return creado;
    });
    return mapEquipo(equipo);
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

    // marcaId: undefined = no tocar; null/'' = limpiar (SET NULL); id = asignar
    // (validando que la marca sea usable para equipos).
    const marcaId =
      dto.marcaId !== undefined ? normNullable(dto.marcaId) : undefined;
    if (marcaId) {
      await this.assertMarcaUsable(tenantId, marcaId);
    }

    // tipoEquipoId: misma semántica que marcaId. Cambiar el tipo en update NO
    // recopia repuestos default (eso solo ocurre al crear el equipo).
    const tipoEquipoId =
      dto.tipoEquipoId !== undefined
        ? normNullable(dto.tipoEquipoId)
        : undefined;
    if (tipoEquipoId) {
      await this.assertTipoEquipoUsable(tenantId, tipoEquipoId);
    }

    const actualizado = await this.prisma.equipo.update({
      where: { id },
      data: {
        ...(codigo !== undefined && { codigo }),
        ...(nombre !== undefined && { nombre }),
        ...(dto.tipo !== undefined && { tipo: normNullable(dto.tipo) }),
        ...(marcaId !== undefined && { marcaId }),
        ...(tipoEquipoId !== undefined && { tipoEquipoId }),
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
    return mapEquipo(actualizado);
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

    const actualizado = await this.prisma.equipo.update({
      where: { id },
      data: { activo: false },
      select: DETAIL_SELECT,
    });
    return mapEquipo(actualizado);
  }

  /**
   * Reactivar un equipo dado de baja: setea activo=true. Idempotente.
   */
  async reactivar(tenantId: string, id: string) {
    const equipoReactivar = await this.prisma.equipo.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!equipoReactivar) {
      throw new NotFoundException(`Equipo con id "${id}" no encontrado`);
    }

    const actualizado = await this.prisma.equipo.update({
      where: { id },
      data: { activo: true },
      select: DETAIL_SELECT,
    });
    return mapEquipo(actualizado);
  }

  /**
   * Cambia SOLO el estado operativo (OPERATIVO / EN_MANTENIMIENTO /
   * FUERA_DE_SERVICIO). Endpoint liviano para la página QR mobile: a diferencia
   * de update() (admin), lo pueden usar mecánico/jefe para marcar el equipo en
   * terreno sin permiso de edición completa.
   */
  async cambiarEstadoOperativo(
    tenantId: string,
    id: string,
    estadoOperativo: EquipoEstadoOperativo,
  ) {
    const equipo = await this.prisma.equipo.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!equipo) {
      throw new NotFoundException(`Equipo con id "${id}" no encontrado`);
    }

    const actualizado = await this.prisma.equipo.update({
      where: { id },
      data: { estadoOperativo },
      select: DETAIL_SELECT,
    });
    return mapEquipo(actualizado);
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

    const actualizado = await this.prisma.equipo.update({
      where: { id },
      data: { qrToken: randomUUID() },
      select: DETAIL_SELECT,
    });
    return mapEquipo(actualizado);
  }

  /**
   * Datos necesarios para imprimir el PDF del QR del equipo: código, nombre,
   * token QR y nombre del tenant (para el encabezado de marca). 404 si el
   * equipo no existe en el tenant o no tiene token QR.
   */
  async getQrPdfData(
    tenantId: string,
    id: string,
  ): Promise<{
    codigo: string;
    nombre: string;
    qrToken: string;
    tenantNombre: string;
  }> {
    const equipo = await this.prisma.equipo.findFirst({
      where: { id, tenantId },
      select: { codigo: true, nombre: true, qrToken: true },
    });
    if (!equipo || !equipo.qrToken) {
      throw new NotFoundException(`Equipo con id "${id}" no encontrado`);
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nombre: true },
    });
    return {
      codigo: equipo.codigo,
      nombre: equipo.nombre,
      qrToken: equipo.qrToken,
      tenantNombre: tenant?.nombre ?? 'Trackt',
    };
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
    return mapEquipo(equipo);
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
      equipo: mapEquipo(equipo),
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

  // ---------- Historial (Fase 6) ----------

  /**
   * Historial completo del equipo: OTs, tickets, evidencias, reservas,
   * movimientos de inventario, consumo agregado por repuesto y
   * programaciones. Cada colección viene acotada (tope defensivo) y
   * ordenada descendente por fecha.
   *
   * Filtros: desde/hasta (createdAt; fechaProgramada en programaciones) y
   * estado — se aplica a cada colección cuyo enum contenga el valor.
   * Las reservas siguen viviendo en el ticket: acá solo se agregan vistas.
   */
  async historial(tenantId: string, id: string, query: HistorialQueryDto) {
    const equipo = await this.prisma.equipo.findFirst({
      where: { id, tenantId },
      select: DETAIL_SELECT,
    });
    if (!equipo) {
      throw new NotFoundException(`Equipo con id "${id}" no encontrado`);
    }

    const rango = this.buildRangoHistorial(query.desde, query.hasta);
    const estados = this.resolverEstadosHistorial(query.estado);

    const ticketsDelEquipo: Prisma.TicketWhereInput = {
      tenantId,
      ot: { equipoId: id },
    };

    const [
      ordenes,
      tickets,
      evidencias,
      reservas,
      movimientos,
      programaciones,
    ] = await this.prisma.$transaction([
      this.prisma.ordenTrabajo.findMany({
        where: {
          tenantId,
          equipoId: id,
          ...(estados.ot && { estado: estados.ot }),
          ...(rango && { createdAt: rango }),
        },
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
        take: 100,
      }),
      this.prisma.ticket.findMany({
        where: {
          ...ticketsDelEquipo,
          ...(estados.ticket && { estado: estados.ticket }),
          ...(rango && { createdAt: rango }),
        },
        select: {
          id: true,
          codigo: true,
          titulo: true,
          estado: true,
          prioridad: true,
          otId: true,
          mecanicoId: true,
          fechaCierre: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      // Evidencias no tienen tenant_id propio: el scoping va por el ticket.
      this.prisma.evidencia.findMany({
        where: {
          ticket: ticketsDelEquipo,
          ...(rango && { createdAt: rango }),
        },
        select: {
          id: true,
          ticketId: true,
          storagePath: true,
          descripcion: true,
          createdAt: true,
          ticket: { select: { codigo: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.reservaRepuesto.findMany({
        where: {
          tenantId,
          ticket: { ot: { equipoId: id } },
          ...(estados.reserva && { estado: estados.reserva }),
          ...(rango && { createdAt: rango }),
        },
        select: {
          id: true,
          ticketId: true,
          estado: true,
          observacion: true,
          createdAt: true,
          ticket: { select: { codigo: true } },
          items: {
            select: {
              cantidad: true,
              repuesto: {
                select: { id: true, codigo: true, nombre: true, unidad: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.movimientoInventario.findMany({
        where: {
          tenantId,
          ticket: { ot: { equipoId: id } },
          ...(rango && { createdAt: rango }),
        },
        select: {
          id: true,
          tipo: true,
          cantidad: true,
          stockResultante: true,
          ticketId: true,
          reservaId: true,
          observacion: true,
          createdAt: true,
          repuesto: {
            select: { id: true, codigo: true, nombre: true, unidad: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.programacionMantenimiento.findMany({
        where: {
          tenantId,
          equipoId: id,
          ...(estados.programacion && { estado: estados.programacion }),
          ...(rango && { fechaProgramada: rango }),
        },
        select: {
          id: true,
          titulo: true,
          fechaProgramada: true,
          estado: true,
          prioridad: true,
          recurrencia: true,
          plantilla: { select: { id: true, nombre: true } },
          metadata: true,
        },
        orderBy: { fechaProgramada: 'desc' },
        take: 100,
      }),
    ]);

    // Consumo agregado por repuesto. Fuera del $transaction porque el
    // tipado de groupBy no sobrevive el array de PrismaPromises.
    const consumoAgrupado = await this.prisma.movimientoInventario.groupBy({
      by: ['repuestoId'],
      where: {
        tenantId,
        tipo: MovimientoInventarioTipo.CONSUMO,
        ticket: { ot: { equipoId: id } },
        ...(rango && { createdAt: rango }),
      },
      _sum: { cantidad: true },
      _count: { _all: true },
      orderBy: { repuestoId: 'asc' },
    });

    // Consumo agregado: nombres de repuesto en una sola query extra.
    const repuestoIds = consumoAgrupado.map((c) => c.repuestoId);
    const repuestos =
      repuestoIds.length > 0
        ? await this.prisma.repuesto.findMany({
            where: { id: { in: repuestoIds }, tenantId },
            select: { id: true, codigo: true, nombre: true, unidad: true },
          })
        : [];
    const repuestoById = new Map(repuestos.map((r) => [r.id, r]));
    const repuestosConsumidos = consumoAgrupado
      .map((c) => ({
        repuestoId: c.repuestoId,
        codigo: repuestoById.get(c.repuestoId)?.codigo ?? c.repuestoId,
        nombre: repuestoById.get(c.repuestoId)?.nombre ?? null,
        unidad: repuestoById.get(c.repuestoId)?.unidad ?? null,
        // CONSUMO registra cantidades negativas; se exponen unidades.
        cantidadConsumida: Math.abs(c._sum.cantidad ?? 0),
        movimientos: c._count._all,
      }))
      .sort((a, b) => b.cantidadConsumida - a.cantidadConsumida);

    return {
      equipo: mapEquipo(equipo),
      filtros: {
        desde: query.desde ?? null,
        hasta: query.hasta ?? null,
        estado: query.estado ?? null,
      },
      ordenes,
      tickets,
      evidencias,
      reservas,
      movimientos,
      repuestosConsumidos,
      programaciones,
    };
  }

  /**
   * Resuelve a qué colecciones aplica el filtro `estado`: a cada enum que
   * contenga el valor (PENDIENTE existe en OT y ticket; PROGRAMADA solo en
   * programaciones). 400 si no calza con ninguno.
   */
  private resolverEstadosHistorial(estado?: string): {
    ot?: OrdenTrabajoEstado;
    ticket?: TicketEstado;
    reserva?: ReservaRepuestoEstado;
    programacion?: ProgramacionMantenimientoEstado;
  } {
    if (!estado) return {};
    const valor = estado.trim().toUpperCase();
    const resultado = {
      ot: (Object.values(OrdenTrabajoEstado) as string[]).includes(valor)
        ? (valor as OrdenTrabajoEstado)
        : undefined,
      ticket: (Object.values(TicketEstado) as string[]).includes(valor)
        ? (valor as TicketEstado)
        : undefined,
      reserva: (Object.values(ReservaRepuestoEstado) as string[]).includes(
        valor,
      )
        ? (valor as ReservaRepuestoEstado)
        : undefined,
      programacion: (
        Object.values(ProgramacionMantenimientoEstado) as string[]
      ).includes(valor)
        ? (valor as ProgramacionMantenimientoEstado)
        : undefined,
    };
    if (
      !resultado.ot &&
      !resultado.ticket &&
      !resultado.reserva &&
      !resultado.programacion
    ) {
      throw new BadRequestException(
        `estado "${estado}" no corresponde a ningún estado de OT/ticket/reserva/programación`,
      );
    }
    return resultado;
  }

  private buildRangoHistorial(
    desde?: string,
    hasta?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!desde && !hasta) return undefined;
    const gte = desde ? new Date(desde) : undefined;
    const lte = hasta ? new Date(hasta) : undefined;
    if (
      (gte && Number.isNaN(gte.getTime())) ||
      (lte && Number.isNaN(lte.getTime()))
    ) {
      throw new BadRequestException('Rango de fechas inválido');
    }
    if (gte && lte && gte > lte) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    return { ...(gte && { gte }), ...(lte && { lte }) };
  }

  /**
   * Valida que la marca exista en el tenant, esté activa y tenga ámbito EQUIPO
   * o AMBOS. 404 si no existe o es de otro tenant (mismo mensaje, no filtra
   * existencia); 409 si existe pero no es usable. Espeja a
   * InventarioService.assertMarcaUsable (que rechaza el ámbito inverso).
   */
  private async assertMarcaUsable(
    tenantId: string,
    marcaId: string,
  ): Promise<void> {
    const marca = await this.prisma.marca.findFirst({
      where: { id: marcaId, tenantId },
      select: { id: true, nombre: true, tipo: true, activo: true },
    });
    if (!marca) {
      throw new NotFoundException(
        `Marca con id "${marcaId}" no encontrada en el tenant`,
      );
    }
    if (!marca.activo) {
      throw new ConflictException(
        `La marca "${marca.nombre}" está inactiva y no puede asignarse`,
      );
    }
    if (marca.tipo === MarcaTipo.REPUESTO) {
      throw new ConflictException(
        `La marca "${marca.nombre}" es de ámbito REPUESTO y no aplica a equipos`,
      );
    }
  }

  /**
   * Valida que el tipo de equipo exista en el tenant y esté activo. 404 si no
   * existe o es de otro tenant (mismo mensaje, no filtra existencia); 409 si
   * existe pero está inactivo. Espeja a assertMarcaUsable.
   */
  private async assertTipoEquipoUsable(
    tenantId: string,
    tipoEquipoId: string,
  ): Promise<void> {
    const tipoEquipo = await this.prisma.tipoEquipo.findFirst({
      where: { id: tipoEquipoId, tenantId },
      select: { id: true, nombre: true, activo: true },
    });
    if (!tipoEquipo) {
      throw new NotFoundException(
        `Tipo de equipo con id "${tipoEquipoId}" no encontrado en el tenant`,
      );
    }
    if (!tipoEquipo.activo) {
      throw new ConflictException(
        `El tipo de equipo "${tipoEquipo.nombre}" está inactivo y no puede asignarse`,
      );
    }
  }
}
