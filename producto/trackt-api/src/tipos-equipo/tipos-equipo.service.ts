import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResult,
  getPrismaSkip,
  PaginatedResult,
} from '../common/utils/pagination';
import { CreateTipoEquipoDto } from './dto/create-tipo-equipo.dto';
import { UpdateTipoEquipoDto } from './dto/update-tipo-equipo.dto';
import { ListTiposEquipoQueryDto } from './dto/list-tipos-equipo-query.dto';
import { AddTipoEquipoRepuestoDto } from './dto/add-tipo-equipo-repuesto.dto';

const TIPO_EQUIPO_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  activo: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TipoEquipoSelect;

// Proyección del repuesto default: ficha + stock para que el frontend muestre
// disponibilidad al armar el catálogo. Espeja ASOCIACION_INCLUDE de
// EquiposRepuestosService.
const REPUESTO_DEFAULT_INCLUDE = {
  repuesto: {
    select: {
      id: true,
      codigo: true,
      nombre: true,
      unidad: true,
      activo: true,
      marcaId: true,
      stock: { select: { stockActual: true, stockReservado: true } },
    },
  },
} satisfies Prisma.TipoEquipoRepuestoDefaultInclude;

type RepuestoDefaultRow = Prisma.TipoEquipoRepuestoDefaultGetPayload<{
  include: typeof REPUESTO_DEFAULT_INCLUDE;
}>;

/**
 * Catálogo de tipos de equipo (datos maestros) por tenant + sus repuestos
 * default. Espejo del módulo Marca; los repuestos default se autocopian a
 * equipos_repuestos cuando se crea un equipo con tipoEquipoId (ver
 * EquiposService.create).
 */
@Injectable()
export class TiposEquipoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: ListTiposEquipoQueryDto,
  ): Promise<
    PaginatedResult<
      Prisma.TipoEquipoGetPayload<{ select: typeof TIPO_EQUIPO_SELECT }>
    >
  > {
    const { page = 1, limit = 10, search, includeInactive } = query;

    const where: Prisma.TipoEquipoWhereInput = {
      tenantId,
      ...(includeInactive ? {} : { activo: true }),
      ...(search && {
        nombre: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.tipoEquipo.findMany({
        where,
        select: TIPO_EQUIPO_SELECT,
        orderBy: { nombre: 'asc' },
        skip: getPrismaSkip(page, limit),
        take: limit,
      }),
      this.prisma.tipoEquipo.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  /**
   * Detalle del tipo con sus repuestos default (ficha + stock disponible del
   * repuesto). Mismo 404 si no existe o es de otro tenant.
   */
  async findOne(tenantId: string, id: string) {
    const tipoEquipo = await this.prisma.tipoEquipo.findFirst({
      where: { id, tenantId },
      select: TIPO_EQUIPO_SELECT,
    });
    if (!tipoEquipo) {
      throw new NotFoundException(`Tipo de equipo con id "${id}" no encontrado`);
    }

    const repuestos = await this.fetchRepuestosDefault(tenantId, id);
    return { ...tipoEquipo, repuestos };
  }

  async create(tenantId: string, dto: CreateTipoEquipoDto) {
    const nombre = dto.nombre.trim();
    if (!nombre) {
      throw new BadRequestException(
        'nombre no puede ser vacío o solo espacios',
      );
    }

    // Dup check case-insensitive: "Excavadora" y "excavadora" son el mismo
    // tipo. La constraint @@unique([tenantId, nombre]) actúa como red de
    // seguridad (exacta) ante carreras.
    await this.assertNombreDisponible(tenantId, nombre);

    return this.prisma.tipoEquipo.create({
      data: {
        tenantId,
        nombre,
        descripcion: normOptional(dto.descripcion),
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
      select: TIPO_EQUIPO_SELECT,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTipoEquipoDto) {
    const tipoEquipo = await this.prisma.tipoEquipo.findFirst({
      where: { id, tenantId },
      select: { id: true, nombre: true },
    });
    if (!tipoEquipo) {
      throw new NotFoundException(`Tipo de equipo con id "${id}" no encontrado`);
    }

    const nombre = dto.nombre !== undefined ? dto.nombre.trim() : undefined;
    if (nombre === '') {
      throw new BadRequestException(
        'nombre no puede ser vacío o solo espacios',
      );
    }

    // Si cambia el nombre, validar que siga libre en el tenant.
    if (nombre !== undefined && nombre !== tipoEquipo.nombre) {
      await this.assertNombreDisponible(tenantId, nombre, id);
    }

    return this.prisma.tipoEquipo.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(dto.descripcion !== undefined && {
          descripcion: normNullable(dto.descripcion),
        }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
        ...(dto.metadata !== undefined && {
          metadata: dto.metadata as Prisma.InputJsonValue,
        }),
      },
      select: TIPO_EQUIPO_SELECT,
    });
  }

  /**
   * Baja lógica, idempotente. Los equipos que referencian el tipo no se tocan
   * (tipoEquipoId se conserva); el tipo solo deja de aparecer en formularios.
   */
  async desactivar(tenantId: string, id: string) {
    const tipoEquipo = await this.prisma.tipoEquipo.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!tipoEquipo) {
      throw new NotFoundException(`Tipo de equipo con id "${id}" no encontrado`);
    }

    return this.prisma.tipoEquipo.update({
      where: { id },
      data: { activo: false },
      select: TIPO_EQUIPO_SELECT,
    });
  }

  // ---------- Repuestos default ----------

  async listRepuestos(tenantId: string, tipoEquipoId: string) {
    await this.requireTipoEquipo(tenantId, tipoEquipoId);
    return this.fetchRepuestosDefault(tenantId, tipoEquipoId);
  }

  async addRepuesto(
    tenantId: string,
    tipoEquipoId: string,
    dto: AddTipoEquipoRepuestoDto,
  ) {
    await this.requireTipoEquipo(tenantId, tipoEquipoId);

    // Repuesto del mismo tenant (mismo 404 si no existe o es ajeno).
    const repuesto = await this.prisma.repuesto.findFirst({
      where: { id: dto.repuestoId, tenantId },
      select: { id: true, codigo: true, activo: true },
    });
    if (!repuesto) {
      throw new NotFoundException(
        `Repuesto con id "${dto.repuestoId}" no encontrado`,
      );
    }
    if (!repuesto.activo) {
      throw new ConflictException(
        `El repuesto "${repuesto.codigo}" está inactivo y no puede asociarse`,
      );
    }

    const existing = await this.prisma.tipoEquipoRepuestoDefault.findUnique({
      where: {
        tenantId_tipoEquipoId_repuestoId: {
          tenantId,
          tipoEquipoId,
          repuestoId: dto.repuestoId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `El repuesto "${repuesto.codigo}" ya es default de este tipo de equipo`,
      );
    }

    // Carrera create-create: la unique constraint dispara P2002 y el
    // PrismaExceptionFilter global lo mapea a 409.
    const created = await this.prisma.tipoEquipoRepuestoDefault.create({
      data: {
        tenantId,
        tipoEquipoId,
        repuestoId: dto.repuestoId,
        cantidadRef: dto.cantidadRef,
        // obligatorio default true en BD; solo se setea si vino explícito.
        ...(dto.obligatorio !== undefined && { obligatorio: dto.obligatorio }),
        observacion: dto.observacion,
      },
      include: REPUESTO_DEFAULT_INCLUDE,
    });
    return this.mapRepuestoDefault(created);
  }

  async removeRepuesto(
    tenantId: string,
    tipoEquipoId: string,
    repuestoId: string,
  ) {
    await this.requireTipoEquipo(tenantId, tipoEquipoId);

    // deleteMany con filtro completo: si no borró nada, el default no existía
    // (o era de otro tenant) → mismo 404.
    const result = await this.prisma.tipoEquipoRepuestoDefault.deleteMany({
      where: { tenantId, tipoEquipoId, repuestoId },
    });
    if (result.count === 0) {
      throw new NotFoundException(
        `El repuesto "${repuestoId}" no es default de este tipo de equipo`,
      );
    }
    return { deleted: true, tipoEquipoId, repuestoId };
  }

  // ---------- helpers ----------

  private async fetchRepuestosDefault(tenantId: string, tipoEquipoId: string) {
    const rows = await this.prisma.tipoEquipoRepuestoDefault.findMany({
      where: { tenantId, tipoEquipoId },
      include: REPUESTO_DEFAULT_INCLUDE,
      orderBy: { repuesto: { codigo: 'asc' } },
    });
    return rows.map((row) => this.mapRepuestoDefault(row));
  }

  private async requireTipoEquipo(
    tenantId: string,
    tipoEquipoId: string,
  ): Promise<void> {
    const tipoEquipo = await this.prisma.tipoEquipo.findFirst({
      where: { id: tipoEquipoId, tenantId },
      select: { id: true },
    });
    if (!tipoEquipo) {
      throw new NotFoundException(
        `Tipo de equipo con id "${tipoEquipoId}" no encontrado`,
      );
    }
  }

  private async assertNombreDisponible(
    tenantId: string,
    nombre: string,
    exceptId?: string,
  ): Promise<void> {
    const dup = await this.prisma.tipoEquipo.findFirst({
      where: {
        tenantId,
        nombre: { equals: nombre, mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        `Ya existe el tipo de equipo "${nombre}" en este tenant`,
      );
    }
  }

  private mapRepuestoDefault(row: RepuestoDefaultRow) {
    const stockActual = row.repuesto.stock?.stockActual ?? 0;
    const stockReservado = row.repuesto.stock?.stockReservado ?? 0;
    return {
      id: row.id,
      tipoEquipoId: row.tipoEquipoId,
      cantidadRef: row.cantidadRef,
      obligatorio: row.obligatorio,
      observacion: row.observacion,
      createdAt: row.createdAt,
      repuesto: {
        id: row.repuesto.id,
        codigo: row.repuesto.codigo,
        nombre: row.repuesto.nombre,
        unidad: row.repuesto.unidad,
        activo: row.repuesto.activo,
        marcaId: row.repuesto.marcaId,
        stockDisponible: stockActual - stockReservado,
      },
    };
  }
}

/** Para campos opcionales en create: '' / espacios → null (no guardar ""). */
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
