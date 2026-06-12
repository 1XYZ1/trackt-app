import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddEquipoRepuestoDto } from './dto/add-equipo-repuesto.dto';

// Proyección del repuesto asociado: ficha + stock para que el frontend
// muestre disponibilidad al planificar mantenciones.
const ASOCIACION_INCLUDE = {
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
} satisfies Prisma.EquipoRepuestoInclude;

type AsociacionRow = Prisma.EquipoRepuestoGetPayload<{
  include: typeof ASOCIACION_INCLUDE;
}>;

/**
 * Repuestos/insumos habituales de un equipo.
 * Base para plantillas de mantenimiento y reservas asistidas (fases 3+).
 */
@Injectable()
export class EquiposRepuestosService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, equipoId: string) {
    await this.requireEquipo(tenantId, equipoId);

    const rows = await this.prisma.equipoRepuesto.findMany({
      where: { tenantId, equipoId },
      include: ASOCIACION_INCLUDE,
      orderBy: { repuesto: { codigo: 'asc' } },
    });
    return rows.map((row) => this.mapAsociacion(row));
  }

  async add(tenantId: string, equipoId: string, dto: AddEquipoRepuestoDto) {
    await this.requireEquipo(tenantId, equipoId);

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

    const existing = await this.prisma.equipoRepuesto.findUnique({
      where: {
        tenantId_equipoId_repuestoId: {
          tenantId,
          equipoId,
          repuestoId: dto.repuestoId,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `El repuesto "${repuesto.codigo}" ya está asociado a este equipo`,
      );
    }

    // Carrera create-create: la unique constraint dispara P2002 y el
    // PrismaExceptionFilter global lo mapea a 409.
    const created = await this.prisma.equipoRepuesto.create({
      data: {
        tenantId,
        equipoId,
        repuestoId: dto.repuestoId,
        cantidadRef: dto.cantidadRef,
        observacion: dto.observacion,
      },
      include: ASOCIACION_INCLUDE,
    });
    return this.mapAsociacion(created);
  }

  async remove(tenantId: string, equipoId: string, repuestoId: string) {
    await this.requireEquipo(tenantId, equipoId);

    // deleteMany con filtro completo: si no borró nada, la asociación no
    // existía (o era de otro tenant) → mismo 404.
    const result = await this.prisma.equipoRepuesto.deleteMany({
      where: { tenantId, equipoId, repuestoId },
    });
    if (result.count === 0) {
      throw new NotFoundException(
        `El repuesto "${repuestoId}" no está asociado a este equipo`,
      );
    }
    return { deleted: true, equipoId, repuestoId };
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
      throw new NotFoundException(
        `Equipo con id "${equipoId}" no encontrado`,
      );
    }
  }

  private mapAsociacion(row: AsociacionRow) {
    const stockActual = row.repuesto.stock?.stockActual ?? 0;
    const stockReservado = row.repuesto.stock?.stockReservado ?? 0;
    return {
      id: row.id,
      equipoId: row.equipoId,
      cantidadRef: row.cantidadRef,
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
