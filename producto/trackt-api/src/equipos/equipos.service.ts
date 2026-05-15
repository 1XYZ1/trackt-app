import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListEquiposQueryDto } from './dto/list-equipos-query.dto';
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
} satisfies Prisma.EquipoSelect;

// Proyección completa para el detalle
const DETAIL_SELECT = {
  id: true,
  codigo: true,
  nombre: true,
  marca: true,
  modelo: true,
  ubicacion: true,
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
    const { page = 1, limit = 10, search } = query;

    const where: Prisma.EquipoWhereInput = {
      tenantId,
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
}
