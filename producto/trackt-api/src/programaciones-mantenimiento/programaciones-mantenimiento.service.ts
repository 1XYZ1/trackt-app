import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrdenTrabajoEstado,
  Prisma,
  ProgramacionMantenimientoEstado,
  TicketEstado,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/types';
import {
  buildPaginatedResult,
  getPrismaSkip,
  PaginatedResult,
} from '../common/utils/pagination';
import { OrdenesService } from '../ordenes/ordenes.service';
import { TicketsService } from '../tickets/tickets.service';
import { InventarioService } from '../inventario/inventario.service';
import { CreateProgramacionDto } from './dto/create-programacion.dto';
import { UpdateProgramacionDto } from './dto/update-programacion.dto';
import { ListProgramacionesQueryDto } from './dto/list-programaciones-query.dto';
import { CalendarioQueryDto } from './dto/calendario-query.dto';
import { GenerarOtDto } from './dto/generar-ot.dto';

// Proyección estándar: la programación + equipo y plantilla mínimos para
// listados y detalle (el calendario usa su propio mapper).
const PROGRAMACION_INCLUDE = {
  equipo: { select: { id: true, codigo: true, nombre: true } },
  plantilla: { select: { id: true, nombre: true } },
} satisfies Prisma.ProgramacionMantenimientoInclude;

type ProgramacionRow = Prisma.ProgramacionMantenimientoGetPayload<{
  include: typeof PROGRAMACION_INCLUDE;
}>;

// Rango máximo de la vista calendario: evita volcar la tabla completa con
// un rango arbitrario (el frontend consulta de a un mes/semana).
const CALENDARIO_RANGO_MAX_DIAS = 366;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Programaciones de mantenimiento: trabajos futuros planificados por equipo,
 * opcionalmente basados en una plantilla. La Fase 5 genera OT/tickets desde
 * programaciones PROGRAMADA (→ GENERADA) y materializa la recurrencia.
 */
// Item de la plantilla resuelto para la reserva (con ajustes aplicados) y
// con la ficha del repuesto para la respuesta SUGERIDA.
export interface ItemReservaResuelto {
  repuestoId: string;
  cantidad: number;
  obligatorio: boolean;
  repuesto: {
    codigo: string;
    nombre: string;
    unidad: string;
    stockDisponible: number;
  };
}

@Injectable()
export class ProgramacionesMantenimientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordenes: OrdenesService,
    private readonly tickets: TicketsService,
    private readonly inventario: InventarioService,
  ) {}

  async findAll(
    tenantId: string,
    query: ListProgramacionesQueryDto,
  ): Promise<PaginatedResult<ProgramacionRow>> {
    const {
      page = 1,
      limit = 10,
      desde,
      hasta,
      equipoId,
      estado,
      responsableId,
      plantillaId,
    } = query;

    const rango = this.buildRangoFechas(desde, hasta);

    const where: Prisma.ProgramacionMantenimientoWhereInput = {
      tenantId,
      ...(rango && { fechaProgramada: rango }),
      ...(equipoId && { equipoId }),
      ...(estado && { estado }),
      ...(responsableId && { responsableId }),
      ...(plantillaId && { plantillaId }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.programacionMantenimiento.findMany({
        where,
        include: PROGRAMACION_INCLUDE,
        orderBy: { fechaProgramada: 'asc' },
        skip: getPrismaSkip(page, limit),
        take: limit,
      }),
      this.prisma.programacionMantenimiento.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /**
   * Vista calendario: eventos planos para el frontend (title/start), rango
   * obligatorio y acotado. Devuelve todos los estados — el front colorea
   * o filtra (una CANCELADA puede interesar como historial visual).
   */
  async calendario(tenantId: string, query: CalendarioQueryDto) {
    const desde = this.parseFecha(query.desde, 'desde');
    const hasta = this.parseFechaHasta(query.hasta);
    // Las validaciones de rango usan la fecha original (no el límite +1d):
    // desde=hasta del mismo día sigue siendo válido.
    if (desde > hasta.fecha) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    if (
      hasta.fecha.getTime() - desde.getTime() >
      CALENDARIO_RANGO_MAX_DIAS * MS_POR_DIA
    ) {
      throw new BadRequestException(
        `El rango del calendario no puede superar ${CALENDARIO_RANGO_MAX_DIAS} días`,
      );
    }

    const rows = await this.prisma.programacionMantenimiento.findMany({
      where: {
        tenantId,
        fechaProgramada: {
          gte: desde,
          ...(hasta.exclusivo ? { lt: hasta.limite } : { lte: hasta.limite }),
        },
      },
      include: PROGRAMACION_INCLUDE,
      orderBy: { fechaProgramada: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.titulo,
      start: row.fechaProgramada,
      estado: row.estado,
      prioridad: row.prioridad,
      equipo: {
        id: row.equipo.id,
        codigo: row.equipo.codigo,
        nombre: row.equipo.nombre,
      },
      plantilla: row.plantilla
        ? { id: row.plantilla.id, nombre: row.plantilla.nombre }
        : null,
    }));
  }

  async findOne(tenantId: string, id: string): Promise<ProgramacionRow> {
    const programacion = await this.prisma.programacionMantenimiento.findFirst({
      where: { id, tenantId },
      include: PROGRAMACION_INCLUDE,
    });
    if (!programacion) {
      throw new NotFoundException(`Programación con id "${id}" no encontrada`);
    }
    return programacion;
  }

  async create(tenantId: string, dto: CreateProgramacionDto) {
    // Equipo del tenant, operable: no se planifica sobre equipos de baja.
    const equipo = await this.prisma.equipo.findFirst({
      where: { id: dto.equipoId, tenantId },
      select: { id: true, codigo: true, activo: true },
    });
    if (!equipo) {
      throw new NotFoundException(
        `Equipo con id "${dto.equipoId}" no encontrado`,
      );
    }
    if (!equipo.activo) {
      throw new ConflictException(
        `El equipo "${equipo.codigo}" está inactivo y no admite programaciones`,
      );
    }

    // Plantilla del tenant y activa (la validación que la Fase 3 dejó
    // comprometida para acá).
    const plantilla = dto.plantillaId
      ? await this.requirePlantillaActiva(tenantId, dto.plantillaId)
      : null;

    const titulo = (dto.titulo ?? '').trim() || plantilla?.nombre || '';
    if (!titulo) {
      throw new BadRequestException(
        'titulo es requerido cuando no se especifica una plantilla',
      );
    }

    const fechaProgramada = this.parseFecha(
      dto.fechaProgramada,
      'fechaProgramada',
    );
    this.assertFechaNoPasada(fechaProgramada);

    if (dto.responsableId) {
      await this.requireResponsable(tenantId, dto.responsableId);
    }

    return this.prisma.programacionMantenimiento.create({
      data: {
        tenantId,
        equipoId: dto.equipoId,
        plantillaId: dto.plantillaId,
        titulo,
        descripcion: this.normalizeOptional(dto.descripcion),
        fechaProgramada,
        responsableId: dto.responsableId,
        prioridad: dto.prioridad,
        recurrencia: this.normalizeOptional(dto.recurrencia),
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
      include: PROGRAMACION_INCLUDE,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateProgramacionDto) {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException(
        'Debe especificar al menos un campo a actualizar',
      );
    }

    const programacion = await this.prisma.programacionMantenimiento.findFirst({
      where: { id, tenantId },
      select: { id: true, estado: true },
    });
    if (!programacion) {
      throw new NotFoundException(`Programación con id "${id}" no encontrada`);
    }
    if (programacion.estado !== ProgramacionMantenimientoEstado.PROGRAMADA) {
      throw new ConflictException(
        `Solo se pueden editar programaciones en estado PROGRAMADA (actual: ${programacion.estado})`,
      );
    }

    const titulo = dto.titulo !== undefined ? dto.titulo.trim() : undefined;
    if (titulo === '') {
      throw new BadRequestException(
        'titulo no puede ser vacío o solo espacios',
      );
    }

    let fechaProgramada: Date | undefined;
    if (dto.fechaProgramada !== undefined) {
      fechaProgramada = this.parseFecha(dto.fechaProgramada, 'fechaProgramada');
      this.assertFechaNoPasada(fechaProgramada);
    }

    // plantillaId: null desvincula; string se valida (existencia + activa).
    if (dto.plantillaId) {
      await this.requirePlantillaActiva(tenantId, dto.plantillaId);
    }
    if (dto.responsableId) {
      await this.requireResponsable(tenantId, dto.responsableId);
    }

    // Guard anti-TOCTOU (mismo patrón que cancelar): el write va condicionado
    // al estado — una cancelación o generación concurrente entre el check
    // inicial y este punto deja count=0 en vez de pisar la fila.
    const result = await this.prisma.programacionMantenimiento.updateMany({
      where: {
        id,
        tenantId,
        estado: ProgramacionMantenimientoEstado.PROGRAMADA,
      },
      data: {
        ...(titulo !== undefined && { titulo }),
        ...(dto.descripcion !== undefined && {
          descripcion: this.normalizeOptional(dto.descripcion),
        }),
        ...(dto.plantillaId !== undefined && {
          plantillaId: dto.plantillaId,
        }),
        ...(fechaProgramada !== undefined && { fechaProgramada }),
        ...(dto.responsableId !== undefined && {
          responsableId: dto.responsableId,
        }),
        ...(dto.prioridad !== undefined && { prioridad: dto.prioridad }),
        ...(dto.recurrencia !== undefined && {
          recurrencia: this.normalizeOptional(dto.recurrencia),
        }),
        ...(dto.metadata !== undefined && {
          metadata: dto.metadata as Prisma.InputJsonValue,
        }),
      },
    });
    if (result.count === 0) {
      const actual = await this.prisma.programacionMantenimiento.findFirst({
        where: { id, tenantId },
        select: { estado: true },
      });
      if (!actual) {
        throw new NotFoundException(
          `Programación con id "${id}" no encontrada`,
        );
      }
      throw new ConflictException(
        `Solo se pueden editar programaciones en estado PROGRAMADA (actual: ${actual.estado})`,
      );
    }

    return this.findOne(tenantId, id);
  }

  /**
   * Cancela una programación PROGRAMADA. Guard anti-TOCTOU: el update va
   * condicionado al estado, igual que las transiciones de tickets — si otra
   * request la mutó en el medio, count = 0 → 409.
   */
  async cancelar(tenantId: string, id: string) {
    const programacion = await this.prisma.programacionMantenimiento.findFirst({
      where: { id, tenantId },
      select: { id: true, estado: true },
    });
    if (!programacion) {
      throw new NotFoundException(`Programación con id "${id}" no encontrada`);
    }

    const result = await this.prisma.programacionMantenimiento.updateMany({
      where: {
        id,
        tenantId,
        estado: ProgramacionMantenimientoEstado.PROGRAMADA,
      },
      data: { estado: ProgramacionMantenimientoEstado.CANCELADA },
    });
    if (result.count === 0) {
      throw new ConflictException(
        `Solo se pueden cancelar programaciones en estado PROGRAMADA (actual: ${programacion.estado})`,
      );
    }

    return this.findOne(tenantId, id);
  }

  // ---------- generar OT (flujo principal, Fase 5) ----------

  /**
   * Genera el mantenimiento desde la programación:
   * OT → ticket → reserva de insumos desde la plantilla → GENERADA.
   *
   * Todo dentro de UNA transacción: si la reserva falla (ej. stock
   * insuficiente → 409 con faltantes), no queda OT ni ticket a medias.
   *
   * - modoReserva AUTOMATICA (default): crea la reserva con los insumos de
   *   la plantilla (más ajustarItems). RESERVADA para admin/jefe_taller;
   *   SOLICITADA para mechanic (sin tocar stockReservado hasta aprobación).
   * - modoReserva SUGERIDA: genera OT/ticket y marca GENERADA, pero NO crea
   *   la reserva; devuelve itemsSugeridos para crearla ajustada con los
   *   endpoints existentes de tickets.
   * - Sin plantilla: genera OT/ticket sin reserva.
   */
  async generarOt(
    tenantId: string,
    user: AuthUser,
    id: string,
    dto: GenerarOtDto,
  ) {
    const programacion = await this.prisma.programacionMantenimiento.findFirst({
      where: { id, tenantId },
      include: {
        plantilla: {
          select: {
            id: true,
            nombre: true,
            items: {
              select: {
                repuestoId: true,
                cantidad: true,
                obligatorio: true,
                repuesto: {
                  select: {
                    codigo: true,
                    nombre: true,
                    unidad: true,
                    stock: {
                      select: { stockActual: true, stockReservado: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!programacion) {
      throw new NotFoundException(`Programación con id "${id}" no encontrada`);
    }
    if (programacion.estado !== ProgramacionMantenimientoEstado.PROGRAMADA) {
      throw new ConflictException(
        `Solo se puede generar desde programaciones en estado PROGRAMADA (actual: ${programacion.estado})`,
      );
    }

    const equipo = await this.prisma.equipo.findFirst({
      where: { id: programacion.equipoId, tenantId },
      select: { id: true, codigo: true, activo: true },
    });
    if (!equipo) {
      throw new NotFoundException(
        `Equipo con id "${programacion.equipoId}" no encontrado`,
      );
    }
    if (!equipo.activo) {
      throw new ConflictException(
        `El equipo "${equipo.codigo}" está inactivo y no admite generación de OT`,
      );
    }

    const modoReserva = dto.modoReserva ?? 'AUTOMATICA';
    const itemsReserva = this.resolverItemsReserva(
      programacion.plantilla,
      dto.ajustarItems,
    );

    const descripcion = programacion.descripcion ?? programacion.titulo;
    const trazabilidad = { programacionId: id };

    const resultado = await this.prisma.$transaction(async (tx) => {
      // Guard anti doble generación: el update va condicionado al estado.
      // Dos requests concurrentes serializan acá; la segunda ve count=0.
      const marcada = await tx.programacionMantenimiento.updateMany({
        where: {
          id,
          tenantId,
          estado: ProgramacionMantenimientoEstado.PROGRAMADA,
        },
        data: { estado: ProgramacionMantenimientoEstado.GENERADA },
      });
      if (marcada.count === 0) {
        throw new ConflictException(
          'La programación ya fue generada o cambió de estado',
        );
      }

      const ot = await this.ordenes.crearEnTx(tx, tenantId, user.id, {
        equipoId: programacion.equipoId,
        descripcion,
        prioridad: programacion.prioridad,
        metadata: trazabilidad,
      });

      let ticket = await this.tickets.crearEnTx(tx, tenantId, user.id, ot.id, {
        titulo: programacion.titulo,
        descripcion,
        prioridad: programacion.prioridad,
        metadata: trazabilidad,
      });

      // mechanic genera para sí mismo: el ticket nace PENDIENTE (crearEnTx)
      // y se auto-asigna en la misma tx, replicando la semántica de
      // asignar() — sin esto el mechanic no vería el ticket que generó
      // (findAll fuerza mecanicoId=user.id) y el modo SUGERIDA quedaría
      // sin salida (crear la reserva exige ser el mecánico asignado).
      // jefeId conserva lo que setea crearEnTx (creador/asignador).
      if (user.role === 'mechanic') {
        ticket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            estado: TicketEstado.ASIGNADO,
            mecanicoId: user.id,
            fechaAsignacion: new Date(),
          },
        });
        await tx.eventoEstadoTicket.create({
          data: {
            ticketId: ticket.id,
            estadoAnterior: TicketEstado.PENDIENTE,
            estadoNuevo: TicketEstado.ASIGNADO,
            usuarioId: user.id,
            observacion: 'Auto-asignado al generar OT desde programación',
          },
        });
      }

      // La OT nace PENDIENTE y su primer ticket la mueve a EN_PROCESO
      // (misma semántica que el hook onTicketCreated, pero atómica).
      const transicion = await tx.ordenTrabajo.updateMany({
        where: {
          id: ot.id,
          tenantId,
          estado: OrdenTrabajoEstado.PENDIENTE,
        },
        data: { estado: OrdenTrabajoEstado.EN_PROCESO },
      });
      if (transicion.count !== 1) {
        throw new ConflictException(
          `OT ${ot.id} mutó concurrentemente — no se pudo transicionar a EN_PROCESO`,
        );
      }

      // Reserva automática: misma lógica que POST /tickets/:id/reservas-
      // repuestos (crearReservaEnTx). mechanic queda SOLICITADA (requiere
      // aprobación y no toca stockReservado); admin/jefe RESERVADA.
      let reserva: Awaited<
        ReturnType<InventarioService['crearReservaEnTx']>
      > | null = null;
      if (modoReserva === 'AUTOMATICA' && itemsReserva.length > 0) {
        reserva = await this.inventario.crearReservaEnTx(
          tx,
          tenantId,
          user,
          ticket.id,
          {
            items: itemsReserva.map(({ repuestoId, cantidad }) => ({
              repuestoId,
              cantidad,
            })),
            observacion:
              dto.observacion ??
              `Reserva generada desde programación "${programacion.titulo}"`,
            solicitar: user.role === 'mechanic',
          },
        );
      }

      // Trazabilidad: la programación recuerda qué generó. La metadata se
      // relee dentro de la tx — la del findFirst inicial es pre-tx y un
      // PATCH concurrente en el medio se pisaría (last-write-wins stale).
      const freshProgramacion =
        await tx.programacionMantenimiento.findUniqueOrThrow({
          where: { id },
          select: { metadata: true },
        });
      const metadataActual = (freshProgramacion.metadata ?? {}) as Record<
        string,
        unknown
      >;
      const programacionActualizada = await tx.programacionMantenimiento.update(
        {
          where: { id },
          data: {
            metadata: {
              ...metadataActual,
              generacion: {
                otId: ot.id,
                otCodigo: ot.codigo,
                ticketId: ticket.id,
                ticketCodigo: ticket.codigo,
                reservaId: reserva?.id ?? null,
                generadoPorId: user.id,
                fecha: new Date().toISOString(),
              },
            } as Prisma.InputJsonValue,
          },
          include: PROGRAMACION_INCLUDE,
        },
      );

      return { programacion: programacionActualizada, ot, ticket, reserva };
    });

    return {
      ...resultado,
      // SUGERIDA: el caller crea la reserva después con los endpoints de
      // tickets; acá van los insumos de la plantilla con su disponibilidad.
      ...(modoReserva === 'SUGERIDA' && { itemsSugeridos: itemsReserva }),
    };
  }

  // ---------- helpers ----------

  /**
   * Resuelve los insumos de la reserva: items de la plantilla con
   * ajustarItems aplicados (cantidad 0 excluye). 400 si se ajusta sin
   * plantilla o se referencia un repuesto que no está en ella.
   */
  private resolverItemsReserva(
    plantilla: {
      items: Array<{
        repuestoId: string;
        cantidad: number;
        obligatorio: boolean;
        repuesto: {
          codigo: string;
          nombre: string;
          unidad: string;
          stock: { stockActual: number; stockReservado: number } | null;
        };
      }>;
    } | null,
    ajustes?: Array<{ repuestoId: string; cantidad: number }>,
  ): ItemReservaResuelto[] {
    if (!plantilla) {
      if (ajustes && ajustes.length > 0) {
        throw new BadRequestException(
          'ajustarItems requiere que la programación tenga plantilla',
        );
      }
      return [];
    }

    // Duplicados: un Map haría last-write-wins silencioso e indeterminado
    // para el cliente — mejor 400 explícito.
    const ajustePorRepuesto = new Map<string, number>();
    for (const ajuste of ajustes ?? []) {
      if (ajustePorRepuesto.has(ajuste.repuestoId)) {
        throw new BadRequestException(
          `ajustarItems repite el repuesto "${ajuste.repuestoId}"`,
        );
      }
      ajustePorRepuesto.set(ajuste.repuestoId, ajuste.cantidad);
    }
    const idsPlantilla = new Set(plantilla.items.map((i) => i.repuestoId));
    for (const repuestoId of ajustePorRepuesto.keys()) {
      if (!idsPlantilla.has(repuestoId)) {
        throw new BadRequestException(
          `ajustarItems referencia el repuesto "${repuestoId}" que no está en la plantilla`,
        );
      }
    }

    return plantilla.items
      .map((item) => {
        const cantidad =
          ajustePorRepuesto.get(item.repuestoId) ?? item.cantidad;
        // Los items de plantilla tienen cantidad >= 1: un 0 solo puede venir
        // de ajustarItems, y los obligatorios no se pueden excluir.
        if (item.obligatorio && cantidad === 0) {
          throw new BadRequestException(
            `El insumo obligatorio "${item.repuesto.codigo}" no puede excluirse de la reserva (cantidad 0)`,
          );
        }
        return {
          repuestoId: item.repuestoId,
          cantidad,
          obligatorio: item.obligatorio,
          repuesto: {
            codigo: item.repuesto.codigo,
            nombre: item.repuesto.nombre,
            unidad: item.repuesto.unidad,
            stockDisponible:
              (item.repuesto.stock?.stockActual ?? 0) -
              (item.repuesto.stock?.stockReservado ?? 0),
          },
        };
      })
      .filter((item) => item.cantidad > 0);
  }

  private async requirePlantillaActiva(tenantId: string, plantillaId: string) {
    const plantilla = await this.prisma.plantillaMantenimiento.findFirst({
      where: { id: plantillaId, tenantId },
      select: { id: true, nombre: true, activo: true },
    });
    if (!plantilla) {
      throw new NotFoundException(
        `Plantilla con id "${plantillaId}" no encontrada`,
      );
    }
    if (!plantilla.activo) {
      throw new ConflictException(
        `La plantilla "${plantilla.nombre}" está inactiva y no puede usarse para programar`,
      );
    }
    return plantilla;
  }

  /**
   * El responsable debe ser un usuario del tenant (cualquier rol). Mismo
   * acceso a public.profiles que usa la asignación de tickets.
   */
  private async requireResponsable(
    tenantId: string,
    responsableId: string,
  ): Promise<void> {
    const responsable = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id::text AS id
      FROM public.profiles
      WHERE id = ${responsableId}::uuid
        AND tenant_id = ${tenantId}
      LIMIT 1
    `;
    if (responsable.length === 0) {
      throw new NotFoundException(
        `Responsable "${responsableId}" no encontrado en el tenant`,
      );
    }
  }

  private buildRangoFechas(
    desde?: string,
    hasta?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!desde && !hasta) return undefined;
    const gte = desde ? this.parseFecha(desde, 'desde') : undefined;
    const h = hasta ? this.parseFechaHasta(hasta) : undefined;
    if (gte && h && gte > h.fecha) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    return {
      ...(gte && { gte }),
      ...(h && (h.exclusivo ? { lt: h.limite } : { lte: h.limite })),
    };
  }

  /**
   * "hasta" date-only (YYYY-MM-DD) se interpreta como fin de día — el
   * contrato es inclusivo, y parsearlo como T00:00:00Z con lte excluiría
   * casi todo el último día del rango. Con hora explícita queda lte exacto.
   */
  private parseFechaHasta(value: string): {
    fecha: Date;
    limite: Date;
    exclusivo: boolean;
  } {
    const fecha = this.parseFecha(value, 'hasta');
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return {
        fecha,
        limite: new Date(fecha.getTime() + MS_POR_DIA),
        exclusivo: true,
      };
    }
    return { fecha, limite: fecha, exclusivo: false };
  }

  private parseFecha(value: string, campo: string): Date {
    const fecha = new Date(value);
    if (Number.isNaN(fecha.getTime())) {
      throw new BadRequestException(`${campo} no es una fecha válida`);
    }
    return fecha;
  }

  /**
   * No se programa en el pasado. Se compara contra el inicio del día (UTC)
   * para no rechazar "hoy" por la hora.
   */
  private assertFechaNoPasada(fecha: Date): void {
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    if (fecha < hoy) {
      throw new BadRequestException(
        'fechaProgramada no puede estar en el pasado',
      );
    }
  }

  private normalizeOptional(value?: string): string | null | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
}
