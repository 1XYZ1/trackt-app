import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarcaTipo, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResult,
  getPrismaSkip,
  PaginatedResult,
} from '../common/utils/pagination';
import { CreateMarcaDto } from './dto/create-marca.dto';
import { UpdateMarcaDto } from './dto/update-marca.dto';
import { ListMarcasQueryDto } from './dto/list-marcas-query.dto';

const MARCA_SELECT = {
  id: true,
  nombre: true,
  tipo: true,
  activo: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MarcaSelect;

@Injectable()
export class MarcasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query: ListMarcasQueryDto,
  ): Promise<
    PaginatedResult<Prisma.MarcaGetPayload<{ select: typeof MARCA_SELECT }>>
  > {
    const { page = 1, limit = 10, search, tipo, includeInactive } = query;

    const where: Prisma.MarcaWhereInput = {
      tenantId,
      ...(includeInactive ? {} : { activo: true }),
      // tipo se interpreta como ámbito: las marcas AMBOS sirven tanto para
      // formularios de equipos como de repuestos.
      ...(tipo && tipo !== MarcaTipo.AMBOS
        ? { tipo: { in: [tipo, MarcaTipo.AMBOS] } }
        : tipo === MarcaTipo.AMBOS
          ? { tipo: MarcaTipo.AMBOS }
          : {}),
      ...(search && {
        nombre: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.marca.findMany({
        where,
        select: MARCA_SELECT,
        orderBy: { nombre: 'asc' },
        skip: getPrismaSkip(page, limit),
        take: limit,
      }),
      this.prisma.marca.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async create(tenantId: string, dto: CreateMarcaDto) {
    const nombre = dto.nombre.trim();
    if (!nombre) {
      throw new BadRequestException(
        'nombre no puede ser vacío o solo espacios',
      );
    }

    // Dup check case-insensitive para el mismo ámbito: "CAT" y "cat" son la
    // misma marca. La constraint @@unique([tenantId, nombre, tipo]) actúa
    // como red de seguridad (exacta) ante carreras.
    await this.assertNombreDisponible(tenantId, nombre, dto.tipo);

    return this.prisma.marca.create({
      data: {
        tenantId,
        nombre,
        tipo: dto.tipo,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
      select: MARCA_SELECT,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateMarcaDto) {
    const marca = await this.prisma.marca.findFirst({
      where: { id, tenantId },
      select: { id: true, nombre: true, tipo: true },
    });
    if (!marca) {
      throw new NotFoundException(`Marca con id "${id}" no encontrada`);
    }

    const nombre = dto.nombre !== undefined ? dto.nombre.trim() : undefined;
    if (nombre === '') {
      throw new BadRequestException(
        'nombre no puede ser vacío o solo espacios',
      );
    }

    // Si cambia nombre o tipo, validar que la combinación siga libre.
    const nombreFinal = nombre ?? marca.nombre;
    const tipoFinal = dto.tipo ?? marca.tipo;
    if (nombreFinal !== marca.nombre || tipoFinal !== marca.tipo) {
      await this.assertNombreDisponible(tenantId, nombreFinal, tipoFinal, id);
    }

    return this.prisma.marca.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(dto.tipo !== undefined && { tipo: dto.tipo }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
        ...(dto.metadata !== undefined && {
          metadata: dto.metadata as Prisma.InputJsonValue,
        }),
      },
      select: MARCA_SELECT,
    });
  }

  /**
   * Baja lógica, idempotente. Los repuestos que referencian la marca no se
   * tocan (marcaId se conserva); la marca solo deja de aparecer en
   * formularios. Para borrado real existe onDelete: SetNull en la FK.
   */
  async desactivar(tenantId: string, id: string) {
    const marca = await this.prisma.marca.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!marca) {
      throw new NotFoundException(`Marca con id "${id}" no encontrada`);
    }

    return this.prisma.marca.update({
      where: { id },
      data: { activo: false },
      select: MARCA_SELECT,
    });
  }

  private async assertNombreDisponible(
    tenantId: string,
    nombre: string,
    tipo: MarcaTipo,
    exceptId?: string,
  ): Promise<void> {
    const dup = await this.prisma.marca.findFirst({
      where: {
        tenantId,
        tipo,
        nombre: { equals: nombre, mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        `Ya existe la marca "${nombre}" para el ámbito ${tipo} en este tenant`,
      );
    }
  }
}
