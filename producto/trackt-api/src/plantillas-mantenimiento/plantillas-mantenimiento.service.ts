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
import { CreatePlantillaDto } from './dto/create-plantilla.dto';
import { UpdatePlantillaDto } from './dto/update-plantilla.dto';
import { ListPlantillasQueryDto } from './dto/list-plantillas-query.dto';
import { AddPlantillaItemDto } from './dto/add-plantilla-item.dto';
import { UpdatePlantillaItemDto } from './dto/update-plantilla-item.dto';

const PLANTILLA_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  tipoEquipo: true,
  frecuencia: true,
  activo: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PlantillaMantenimientoSelect;

// Listado: la ficha + cuántos insumos tiene la receta (sin traerlos).
const PLANTILLA_LIST_SELECT = {
  ...PLANTILLA_SELECT,
  _count: { select: { items: true } },
} satisfies Prisma.PlantillaMantenimientoSelect;

// Ítems con la ficha del repuesto + stock, igual que equipos_repuestos:
// el frontend muestra disponibilidad al armar la receta.
const ITEM_INCLUDE = {
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
} satisfies Prisma.PlantillaMantenimientoItemInclude;

type ItemRow = Prisma.PlantillaMantenimientoItemGetPayload<{
  include: typeof ITEM_INCLUDE;
}>;

// Límites del checklist embebido en metadata.checklist. Si la operación
// llega a necesitar estado/orden/fotos por paso, migrar a tabla propia.
const CHECKLIST_MAX_PASOS = 100;
const CHECKLIST_MAX_LARGO_PASO = 500;

/**
 * Plantillas de mantenimiento: "recetas" reutilizables con checklist
 * (metadata.checklist) e insumos sugeridos. En fases 4+ alimentan
 * programaciones, generación de OT/tickets y reservas de inventario.
 */
@Injectable()
export class PlantillasMantenimientoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: ListPlantillasQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const { page = 1, limit = 10, search, tipoEquipo, includeInactive } = query;

    const where: Prisma.PlantillaMantenimientoWhereInput = {
      tenantId,
      ...(includeInactive ? {} : { activo: true }),
      ...(tipoEquipo && {
        tipoEquipo: { equals: tipoEquipo, mode: 'insensitive' as const },
      }),
      ...(search && {
        nombre: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.plantillaMantenimiento.findMany({
        where,
        select: PLANTILLA_LIST_SELECT,
        orderBy: { nombre: 'asc' },
        skip: getPrismaSkip(page, limit),
        take: limit,
      }),
      this.prisma.plantillaMantenimiento.count({ where }),
    ]);

    const data = rows.map(({ _count, ...plantilla }) => ({
      ...plantilla,
      itemsCount: _count.items,
    }));
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(tenantId: string, id: string) {
    const plantilla = await this.prisma.plantillaMantenimiento.findFirst({
      where: { id, tenantId },
      select: {
        ...PLANTILLA_SELECT,
        items: {
          include: ITEM_INCLUDE,
          orderBy: { repuesto: { codigo: 'asc' } },
        },
      },
    });
    if (!plantilla) {
      throw new NotFoundException(`Plantilla con id "${id}" no encontrada`);
    }

    const { items, ...rest } = plantilla;
    return { ...rest, items: items.map((item) => this.mapItem(item)) };
  }

  async create(tenantId: string, dto: CreatePlantillaDto) {
    const nombre = dto.nombre.trim();
    if (!nombre) {
      throw new BadRequestException(
        'nombre no puede ser vacío o solo espacios',
      );
    }
    this.assertChecklistValida(dto.metadata);

    return this.prisma.plantillaMantenimiento.create({
      data: {
        tenantId,
        nombre,
        descripcion: this.normalizeOptional(dto.descripcion),
        tipoEquipo: this.normalizeOptional(dto.tipoEquipo),
        frecuencia: this.normalizeOptional(dto.frecuencia),
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
      select: PLANTILLA_SELECT,
    });
  }

  async update(tenantId: string, id: string, dto: UpdatePlantillaDto) {
    await this.requirePlantilla(tenantId, id);

    const nombre = dto.nombre !== undefined ? dto.nombre.trim() : undefined;
    if (nombre === '') {
      throw new BadRequestException(
        'nombre no puede ser vacío o solo espacios',
      );
    }
    this.assertChecklistValida(dto.metadata);

    return this.prisma.plantillaMantenimiento.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(dto.descripcion !== undefined && {
          descripcion: this.normalizeOptional(dto.descripcion),
        }),
        ...(dto.tipoEquipo !== undefined && {
          tipoEquipo: this.normalizeOptional(dto.tipoEquipo),
        }),
        ...(dto.frecuencia !== undefined && {
          frecuencia: this.normalizeOptional(dto.frecuencia),
        }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
        // null limpia la columna (DbNull = NULL SQL, coherente con el
        // estado inicial de metadata Json?).
        ...(dto.metadata !== undefined && {
          metadata:
            dto.metadata === null
              ? Prisma.DbNull
              : (dto.metadata as Prisma.InputJsonValue),
        }),
      },
      select: PLANTILLA_SELECT,
    });
  }

  /**
   * Baja lógica, idempotente. Las asociaciones equipo↔plantilla se
   * conservan, pero una plantilla inactiva no puede asociarse a nuevos
   * equipos ni usarse para programar mantenimientos (Fase 4 valida lo
   * mismo al crear programaciones).
   */
  async desactivar(tenantId: string, id: string) {
    await this.requirePlantilla(tenantId, id);

    return this.prisma.plantillaMantenimiento.update({
      where: { id },
      data: { activo: false },
      select: PLANTILLA_SELECT,
    });
  }

  // ---------- items ----------

  async addItem(
    tenantId: string,
    plantillaId: string,
    dto: AddPlantillaItemDto,
  ) {
    await this.requirePlantilla(tenantId, plantillaId);

    // Transacción: cierra la ventana check-activo → create (una
    // desactivación concurrente del repuesto se detecta con el re-check
    // post-create y revierte todo).
    const created = await this.prisma.$transaction(async (tx) => {
      // Repuesto del mismo tenant (mismo 404 si no existe o es ajeno).
      const repuesto = await tx.repuesto.findFirst({
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
          `El repuesto "${repuesto.codigo}" está inactivo y no puede agregarse a la plantilla`,
        );
      }

      const existing = await tx.plantillaMantenimientoItem.findUnique({
        where: {
          tenantId_plantillaId_repuestoId: {
            tenantId,
            plantillaId,
            repuestoId: dto.repuestoId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          `El repuesto "${repuesto.codigo}" ya está en esta plantilla`,
        );
      }

      // Carrera create-create: la unique constraint dispara P2002 y el
      // PrismaExceptionFilter global lo mapea a 409.
      const row = await tx.plantillaMantenimientoItem.create({
        data: {
          tenantId,
          plantillaId,
          repuestoId: dto.repuestoId,
          cantidad: dto.cantidad,
          obligatorio: dto.obligatorio,
          observacion: this.normalizeOptional(dto.observacion),
        },
        include: ITEM_INCLUDE,
      });

      // Check-after-write: bajo read-committed, una desactivación commiteada
      // entre el check inicial y el create se ve aquí y revierte la tx.
      const fresh = await tx.repuesto.findUniqueOrThrow({
        where: { id: dto.repuestoId },
        select: { activo: true, codigo: true },
      });
      if (!fresh.activo) {
        throw new ConflictException(
          `El repuesto "${fresh.codigo}" está inactivo y no puede agregarse a la plantilla`,
        );
      }
      return row;
    });
    return this.mapItem(created);
  }

  async updateItem(
    tenantId: string,
    plantillaId: string,
    itemId: string,
    dto: UpdatePlantillaItemDto,
  ) {
    if (
      dto.cantidad === undefined &&
      dto.obligatorio === undefined &&
      dto.observacion === undefined
    ) {
      throw new BadRequestException(
        'Debe especificar al menos un campo a actualizar',
      );
    }
    await this.requirePlantilla(tenantId, plantillaId);

    const item = await this.prisma.plantillaMantenimientoItem.findFirst({
      where: { id: itemId, tenantId, plantillaId },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException(
        `Ítem con id "${itemId}" no encontrado en esta plantilla`,
      );
    }

    const updated = await this.prisma.plantillaMantenimientoItem.update({
      where: { id: itemId },
      data: {
        ...(dto.cantidad !== undefined && { cantidad: dto.cantidad }),
        ...(dto.obligatorio !== undefined && { obligatorio: dto.obligatorio }),
        // ''→null: permite limpiar la observación, igual que los campos
        // opcionales de la plantilla.
        ...(dto.observacion !== undefined && {
          observacion: this.normalizeOptional(dto.observacion),
        }),
      },
      include: ITEM_INCLUDE,
    });
    return this.mapItem(updated);
  }

  async removeItem(tenantId: string, plantillaId: string, itemId: string) {
    await this.requirePlantilla(tenantId, plantillaId);

    // deleteMany con filtro completo: si no borró nada, el ítem no existía
    // (o era de otro tenant/plantilla) → mismo 404.
    const result = await this.prisma.plantillaMantenimientoItem.deleteMany({
      where: { id: itemId, tenantId, plantillaId },
    });
    if (result.count === 0) {
      throw new NotFoundException(
        `Ítem con id "${itemId}" no encontrado en esta plantilla`,
      );
    }
    return { deleted: true, plantillaId, itemId };
  }

  // ---------- helpers ----------

  private async requirePlantilla(
    tenantId: string,
    plantillaId: string,
  ): Promise<void> {
    const plantilla = await this.prisma.plantillaMantenimiento.findFirst({
      where: { id: plantillaId, tenantId },
      select: { id: true },
    });
    if (!plantilla) {
      throw new NotFoundException(
        `Plantilla con id "${plantillaId}" no encontrada`,
      );
    }
  }

  /**
   * metadata.checklist es la versión simple del checklist: string[] de
   * pasos. Se valida la forma para que el frontend pueda confiar en ella.
   */
  private assertChecklistValida(
    metadata?: Record<string, unknown> | null,
  ): void {
    if (!metadata || metadata.checklist === undefined) return;

    const checklist = metadata.checklist;
    if (!Array.isArray(checklist)) {
      throw new BadRequestException(
        'metadata.checklist debe ser un arreglo de strings',
      );
    }
    if (checklist.length > CHECKLIST_MAX_PASOS) {
      throw new BadRequestException(
        `metadata.checklist admite hasta ${CHECKLIST_MAX_PASOS} pasos`,
      );
    }
    const valido = checklist.every(
      (paso) =>
        typeof paso === 'string' &&
        paso.trim().length > 0 &&
        paso.length <= CHECKLIST_MAX_LARGO_PASO,
    );
    if (!valido) {
      throw new BadRequestException(
        'metadata.checklist solo admite strings no vacíos',
      );
    }
  }

  private normalizeOptional(value?: string): string | null | undefined {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  private mapItem(row: ItemRow) {
    const stockActual = row.repuesto.stock?.stockActual ?? 0;
    const stockReservado = row.repuesto.stock?.stockReservado ?? 0;
    return {
      id: row.id,
      plantillaId: row.plantillaId,
      cantidad: row.cantidad,
      obligatorio: row.obligatorio,
      observacion: row.observacion,
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
