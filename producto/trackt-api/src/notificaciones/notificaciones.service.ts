import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificacionTipo, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildPaginatedResult,
  getPrismaSkip,
  PaginatedResult,
} from '../common/utils/pagination';
import { ListNotificacionesQueryDto } from './dto/list-notificaciones-query.dto';
import {
  NotificacionPayload,
  NotificacionResponseDto,
} from './dto/notificacion-response.dto';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Emite una notificación al usuario destinatario.
   * Fire-and-forget: cualquier fallo se loggea pero NO interrumpe el flujo
   * de negocio (transición de ticket, etc).
   */
  async emit(
    tenantId: string,
    usuarioId: string,
    tipo: NotificacionTipo,
    payload: NotificacionPayload,
  ): Promise<void> {
    try {
      await this.prisma.notificacion.create({
        data: {
          tenantId,
          usuarioId,
          tipo,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Notificacion ${tipo} para ${usuarioId} falló: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }
  }

  async findAll(
    tenantId: string,
    usuarioId: string,
    query: ListNotificacionesQueryDto,
  ): Promise<PaginatedResult<NotificacionResponseDto>> {
    const { page = 1, limit = 10, tipo, soloNoLeidas } = query;

    const where: Prisma.NotificacionWhereInput = {
      tenantId,
      usuarioId,
      ...(tipo && { tipo }),
      ...(soloNoLeidas && { leida: false }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notificacion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: getPrismaSkip(page, limit),
        take: limit,
      }),
      this.prisma.notificacion.count({ where }),
    ]);

    const data: NotificacionResponseDto[] = rows.map((row) => ({
      id: row.id,
      tipo: row.tipo,
      payload: (row.payload as NotificacionPayload) ?? {},
      leida: row.leida,
      createdAt: row.createdAt.toISOString(),
    }));

    return buildPaginatedResult(data, total, page, limit);
  }

  async countNoLeidas(tenantId: string, usuarioId: string): Promise<number> {
    return this.prisma.notificacion.count({
      where: { tenantId, usuarioId, leida: false },
    });
  }

  async marcarLeida(
    tenantId: string,
    usuarioId: string,
    id: string,
  ): Promise<void> {
    const result = await this.prisma.notificacion.updateMany({
      where: { id, tenantId, usuarioId },
      data: { leida: true },
    });
    if (result.count === 0) {
      throw new NotFoundException(`Notificación "${id}" no encontrada`);
    }
  }

  async marcarTodasLeidas(
    tenantId: string,
    usuarioId: string,
  ): Promise<{ count: number }> {
    const result = await this.prisma.notificacion.updateMany({
      where: { tenantId, usuarioId, leida: false },
      data: { leida: true },
    });
    return { count: result.count };
  }
}
