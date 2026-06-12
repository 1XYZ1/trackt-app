import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProgramacionMantenimientoEstado } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResult,
  getPrismaSkip,
  PaginatedResult,
} from '../common/utils/pagination';
import { CreateProgramacionDto } from './dto/create-programacion.dto';
import { UpdateProgramacionDto } from './dto/update-programacion.dto';
import { ListProgramacionesQueryDto } from './dto/list-programaciones-query.dto';
import { CalendarioQueryDto } from './dto/calendario-query.dto';

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
@Injectable()
export class ProgramacionesMantenimientoService {
  constructor(private readonly prisma: PrismaService) {}

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
    const hasta = this.parseFecha(query.hasta, 'hasta');
    if (desde > hasta) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    if (
      hasta.getTime() - desde.getTime() >
      CALENDARIO_RANGO_MAX_DIAS * MS_POR_DIA
    ) {
      throw new BadRequestException(
        `El rango del calendario no puede superar ${CALENDARIO_RANGO_MAX_DIAS} días`,
      );
    }

    const rows = await this.prisma.programacionMantenimiento.findMany({
      where: { tenantId, fechaProgramada: { gte: desde, lte: hasta } },
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

    return this.prisma.programacionMantenimiento.update({
      where: { id },
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
      include: PROGRAMACION_INCLUDE,
    });
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

  // ---------- helpers ----------

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
    const lte = hasta ? this.parseFecha(hasta, 'hasta') : undefined;
    if (gte && lte && gte > lte) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    return { ...(gte && { gte }), ...(lte && { lte }) };
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
