import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListEquiposQueryDto } from './dto/list-equipos-query.dto';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import {
  buildPaginatedResult,
  getPrismaSkip,
  PaginatedResult,
} from '../common/utils/pagination';
import { Prisma } from '@prisma/client';

// Proyección pública para la lista (sin metadata ni timestamps)
const LIST_SELECT = {
  id: true,
  codigo: true,
  nombre: true,
  marca: true,
  modelo: true,
  ubicacion: true,
  activo: true,
} satisfies Prisma.EquipoSelect;

// Proyección completa para el detalle
const DETAIL_SELECT = {
  id: true,
  codigo: true,
  nombre: true,
  marca: true,
  modelo: true,
  ubicacion: true,
  activo: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EquipoSelect;

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
          { marca: { contains: search, mode: 'insensitive' } },
          { modelo: { contains: search, mode: 'insensitive' } },
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
    // Validar duplicado de código antes de insertar para devolver 409 explícito.
    // La constraint @@unique([tenantId, codigo]) actúa como red de seguridad.
    const existing = await this.prisma.equipo.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: dto.codigo } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un equipo con codigo "${dto.codigo}" en este tenant`,
      );
    }

    return this.prisma.equipo.create({
      data: {
        tenantId,
        codigo: dto.codigo,
        nombre: dto.nombre,
        marca: dto.marca,
        modelo: dto.modelo,
        ubicacion: dto.ubicacion,
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

    // Si cambia el codigo, validar duplicados en el mismo tenant.
    if (dto.codigo !== undefined && dto.codigo !== equipo.codigo) {
      const dup = await this.prisma.equipo.findUnique({
        where: { tenantId_codigo: { tenantId, codigo: dto.codigo } },
        select: { id: true },
      });
      if (dup && dup.id !== id) {
        throw new ConflictException(
          `Ya existe un equipo con codigo "${dto.codigo}" en este tenant`,
        );
      }
    }

    return this.prisma.equipo.update({
      where: { id },
      data: {
        ...(dto.codigo !== undefined && { codigo: dto.codigo }),
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.marca !== undefined && { marca: dto.marca }),
        ...(dto.modelo !== undefined && { modelo: dto.modelo }),
        ...(dto.ubicacion !== undefined && { ubicacion: dto.ubicacion }),
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
}
