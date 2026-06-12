import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Proyección de la plantilla asociada: ficha + cuántos insumos define,
// para que la ficha del equipo muestre sus recetas sin otra query.
const ASOCIACION_INCLUDE = {
  plantilla: {
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      tipoEquipo: true,
      frecuencia: true,
      activo: true,
      _count: { select: { items: true } },
    },
  },
} satisfies Prisma.EquipoPlantillaMantenimientoInclude;

type AsociacionRow = Prisma.EquipoPlantillaMantenimientoGetPayload<{
  include: typeof ASOCIACION_INCLUDE;
}>;

/**
 * Plantillas de mantenimiento que aplican a un equipo. En Fase 4 el
 * calendario propone programaciones a partir de estas asociaciones.
 */
@Injectable()
export class EquiposPlantillasService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, equipoId: string) {
    await this.requireEquipo(tenantId, equipoId);

    const rows = await this.prisma.equipoPlantillaMantenimiento.findMany({
      where: { tenantId, equipoId },
      include: ASOCIACION_INCLUDE,
      orderBy: { plantilla: { nombre: 'asc' } },
    });
    return rows.map((row) => this.mapAsociacion(row));
  }

  async add(tenantId: string, equipoId: string, plantillaId: string) {
    await this.requireEquipo(tenantId, equipoId);

    // Transacción: cierra la ventana check-activo → create (una
    // desactivación concurrente de la plantilla se detecta con el re-check
    // post-create y revierte todo).
    const created = await this.prisma.$transaction(async (tx) => {
      // Plantilla del mismo tenant (mismo 404 si no existe o es ajena).
      const plantilla = await tx.plantillaMantenimiento.findFirst({
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
          `La plantilla "${plantilla.nombre}" está inactiva y no puede asociarse a un equipo`,
        );
      }

      const existing = await tx.equipoPlantillaMantenimiento.findUnique({
        where: {
          tenantId_equipoId_plantillaId: {
            tenantId,
            equipoId,
            plantillaId,
          },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          `La plantilla "${plantilla.nombre}" ya está asociada a este equipo`,
        );
      }

      // Carrera create-create: la unique constraint dispara P2002 y el
      // PrismaExceptionFilter global lo mapea a 409.
      const row = await tx.equipoPlantillaMantenimiento.create({
        data: { tenantId, equipoId, plantillaId },
        include: ASOCIACION_INCLUDE,
      });

      // Check-after-write: bajo read-committed, una desactivación commiteada
      // entre el check inicial y el create se ve aquí y revierte la tx.
      const fresh = await tx.plantillaMantenimiento.findUniqueOrThrow({
        where: { id: plantillaId },
        select: { activo: true, nombre: true },
      });
      if (!fresh.activo) {
        throw new ConflictException(
          `La plantilla "${fresh.nombre}" está inactiva y no puede asociarse a un equipo`,
        );
      }
      return row;
    });
    return this.mapAsociacion(created);
  }

  async remove(tenantId: string, equipoId: string, plantillaId: string) {
    await this.requireEquipo(tenantId, equipoId);

    // deleteMany con filtro completo: si no borró nada, la asociación no
    // existía (o era de otro tenant) → mismo 404.
    const result = await this.prisma.equipoPlantillaMantenimiento.deleteMany({
      where: { tenantId, equipoId, plantillaId },
    });
    if (result.count === 0) {
      throw new NotFoundException(
        `La plantilla "${plantillaId}" no está asociada a este equipo`,
      );
    }
    return { deleted: true, equipoId, plantillaId };
  }

  private async requireEquipo(
    tenantId: string,
    equipoId: string,
  ): Promise<void> {
    const equipo = await this.prisma.equipo.findFirst({
      where: { id: equipoId, tenantId },
      select: { id: true },
    });
    if (!equipo) {
      throw new NotFoundException(`Equipo con id "${equipoId}" no encontrado`);
    }
  }

  private mapAsociacion(row: AsociacionRow) {
    return {
      id: row.id,
      equipoId: row.equipoId,
      createdAt: row.createdAt,
      plantilla: {
        id: row.plantilla.id,
        nombre: row.plantilla.nombre,
        descripcion: row.plantilla.descripcion,
        tipoEquipo: row.plantilla.tipoEquipo,
        frecuencia: row.plantilla.frecuencia,
        activo: row.plantilla.activo,
        itemsCount: row.plantilla._count.items,
      },
    };
  }
}
