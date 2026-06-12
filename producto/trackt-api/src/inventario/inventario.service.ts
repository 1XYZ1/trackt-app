import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MarcaTipo,
  MovimientoInventarioTipo,
  Prisma,
  ReservaRepuestoEstado,
  TicketEstado,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/types';
import {
  buildPaginatedResult,
  getPrismaSkip,
} from '../common/utils/pagination';
import { AjusteStockDto } from './dto/ajuste-stock.dto';
import { CreateRepuestoDto } from './dto/create-repuesto.dto';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { EntradaStockDto } from './dto/entrada-stock.dto';
import { ListMovimientosQueryDto } from './dto/list-movimientos-query.dto';
import { ListRepuestosQueryDto } from './dto/list-repuestos-query.dto';
import { ReservaActionDto } from './dto/reserva-action.dto';
import { UpdateRepuestoDto } from './dto/update-repuesto.dto';

// Estados terminales: bloquean la creación de reservas y operaciones sobre tickets.
const TICKET_ESTADOS_TERMINALES: TicketEstado[] = [
  TicketEstado.EJECUTADO,
  TicketEstado.CERRADO,
  TicketEstado.CANCELADO,
];

const REPUESTO_DETAIL_INCLUDE = {
  stock: true,
  marca: { select: { id: true, nombre: true, tipo: true, activo: true } },
} satisfies Prisma.RepuestoInclude;

const RESERVA_DETAIL_INCLUDE = {
  items: {
    include: {
      repuesto: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          unidad: true,
        },
      },
    },
  },
} satisfies Prisma.ReservaRepuestoInclude;

@Injectable()
export class InventarioService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================
  // Repuestos
  // ============================================================

  async createRepuesto(tenantId: string, userId: string, dto: CreateRepuestoDto) {
    const codigo = dto.codigo.trim();
    const stockInicial = dto.stockInicial ?? 0;

    if (dto.marcaId) {
      await this.assertMarcaUsable(tenantId, dto.marcaId);
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Check de duplicado dentro de la tx: dos requests concurrentes
        // serializan en la unique constraint y el segundo cae al catch P2002.
        const dup = await tx.repuesto.findUnique({
          where: { tenantId_codigo: { tenantId, codigo } },
          select: { id: true },
        });
        if (dup) {
          throw new ConflictException(
            `Ya existe un repuesto con codigo "${codigo}" en este tenant`,
          );
        }

        const repuesto = await tx.repuesto.create({
          data: {
            tenantId,
            codigo,
            nombre: dto.nombre,
            descripcion: dto.descripcion,
            categoria: dto.categoria,
            unidad: dto.unidad ?? 'unidad',
            stockMinimo: dto.stockMinimo ?? 0,
            marcaId: dto.marcaId,
            codigoFabricante: dto.codigoFabricante,
            ubicacionBodega: dto.ubicacionBodega,
            proveedor: dto.proveedor,
            metadata: dto.metadata as Prisma.InputJsonValue | undefined,
          },
        });

        await tx.inventarioStock.create({
          data: {
            tenantId,
            repuestoId: repuesto.id,
            stockActual: stockInicial,
            stockReservado: 0,
          },
        });

        if (stockInicial > 0) {
          await tx.movimientoInventario.create({
            data: {
              tenantId,
              repuestoId: repuesto.id,
              tipo: MovimientoInventarioTipo.ENTRADA,
              cantidad: stockInicial,
              stockResultante: stockInicial,
              usuarioId: userId,
              observacion: 'Stock inicial',
            },
          });
        }

        return tx.repuesto.findUniqueOrThrow({
          where: { id: repuesto.id },
          include: REPUESTO_DETAIL_INCLUDE,
        });
      });

      return this.mapRepuesto(created);
    } catch (err) {
      // Race: dos requests pasaron el check antes de crear → P2002 en unique.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          `Ya existe un repuesto con codigo "${codigo}" en este tenant`,
        );
      }
      throw err;
    }
  }

  async findAllRepuestos(
    tenantId: string,
    user: AuthUser,
    query: ListRepuestosQueryDto,
  ) {
    const {
      page = 1,
      limit = 10,
      search,
      categoria,
      marcaId,
      includeInactive,
      bajoStock,
    } = query;

    const where: Prisma.RepuestoWhereInput = {
      tenantId,
      // mechanic solo ve repuestos activos; admin/jefe pueden ver todos si lo piden.
      ...(user.role === 'mechanic' || !includeInactive ? { activo: true } : {}),
      ...(categoria && { categoria }),
      ...(marcaId && { marcaId }),
      ...(search && {
        OR: [
          { codigo: { contains: search, mode: 'insensitive' } },
          { nombre: { contains: search, mode: 'insensitive' } },
          { descripcion: { contains: search, mode: 'insensitive' } },
          { categoria: { contains: search, mode: 'insensitive' } },
        ],
      }),
      // bajoStock se evalua en BD usando la relacion stock 1:1:
      //   stock_actual - stock_reservado <= stock_minimo
      // Prisma no expone "columna - columna <= columna" en filtros nativos,
      // por lo que delegamos al raw filter a continuacion.
    };

    if (bajoStock) {
      // Paginacion correcta con filtro derivado: traemos los ids que cumplen
      // la condicion y luego cargamos las paginas con el where base.
      const idsBajoStock = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT r.id
        FROM repuestos r
        JOIN inventario_stock s ON s.repuesto_id = r.id
        WHERE r.tenant_id = ${tenantId}
          AND (s.stock_actual - s.stock_reservado) <= r.stock_minimo
      `;
      where.id = { in: idsBajoStock.map((row) => row.id) };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.repuesto.findMany({
        where,
        include: REPUESTO_DETAIL_INCLUDE,
        orderBy: { codigo: 'asc' },
        skip: getPrismaSkip(page, limit),
        take: limit,
      }),
      this.prisma.repuesto.count({ where }),
    ]);

    const data = rows.map((r) => this.mapRepuesto(r));
    return buildPaginatedResult(data, total, page, limit);
  }

  async findOneRepuesto(tenantId: string, user: AuthUser, id: string) {
    const repuesto = await this.prisma.repuesto.findFirst({
      where: { id, tenantId },
      include: REPUESTO_DETAIL_INCLUDE,
    });
    if (!repuesto) {
      throw new NotFoundException(`Repuesto con id "${id}" no encontrado`);
    }

    // Movimientos solo para admin/jefe_taller (consistente con
    // findAllMovimientos). mechanic obtiene array vacio.
    const verMovimientos =
      user.role === 'admin' || user.role === 'jefe_taller';
    const movimientos = verMovimientos
      ? await this.prisma.movimientoInventario.findMany({
          where: { repuestoId: id, tenantId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        })
      : [];

    return {
      ...this.mapRepuesto(repuesto),
      movimientosRecientes: movimientos,
    };
  }

  async updateRepuesto(
    tenantId: string,
    id: string,
    dto: UpdateRepuestoDto,
  ) {
    const current = await this.prisma.repuesto.findFirst({
      where: { id, tenantId },
      select: { id: true, codigo: true },
    });
    if (!current) {
      throw new NotFoundException(`Repuesto con id "${id}" no encontrado`);
    }

    if (dto.codigo !== undefined && dto.codigo !== current.codigo) {
      const dup = await this.prisma.repuesto.findUnique({
        where: { tenantId_codigo: { tenantId, codigo: dto.codigo } },
        select: { id: true },
      });
      if (dup && dup.id !== id) {
        throw new ConflictException(
          `Ya existe un repuesto con codigo "${dto.codigo}" en este tenant`,
        );
      }
    }

    // marcaId: null limpia la marca; string requiere marca usable del tenant.
    if (dto.marcaId) {
      await this.assertMarcaUsable(tenantId, dto.marcaId);
    }

    const updated = await this.prisma.repuesto.update({
      where: { id },
      data: {
        ...(dto.codigo !== undefined && { codigo: dto.codigo }),
        ...(dto.nombre !== undefined && { nombre: dto.nombre }),
        ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
        ...(dto.categoria !== undefined && { categoria: dto.categoria }),
        ...(dto.unidad !== undefined && { unidad: dto.unidad }),
        ...(dto.stockMinimo !== undefined && { stockMinimo: dto.stockMinimo }),
        ...(dto.activo !== undefined && { activo: dto.activo }),
        ...(dto.marcaId !== undefined && { marcaId: dto.marcaId }),
        ...(dto.codigoFabricante !== undefined && {
          codigoFabricante: dto.codigoFabricante,
        }),
        ...(dto.ubicacionBodega !== undefined && {
          ubicacionBodega: dto.ubicacionBodega,
        }),
        ...(dto.proveedor !== undefined && { proveedor: dto.proveedor }),
        ...(dto.metadata !== undefined && {
          metadata: dto.metadata as Prisma.InputJsonValue,
        }),
      },
      include: REPUESTO_DETAIL_INCLUDE,
    });

    return this.mapRepuesto(updated);
  }

  async desactivarRepuesto(tenantId: string, id: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      // Lock por repuesto: serializa contra create/aprobar reserva concurrente,
      // que tambien toman este lock y mutan stockReservado.
      await this.lockRepuesto(tx, tenantId, id);

      const repuesto = await tx.repuesto.findFirst({
        where: { id, tenantId },
        include: { stock: true },
      });
      if (!repuesto) {
        throw new NotFoundException(`Repuesto con id "${id}" no encontrado`);
      }
      if ((repuesto.stock?.stockReservado ?? 0) > 0) {
        throw new ConflictException(
          'No se puede desactivar un repuesto con stock reservado. Libera las reservas primero.',
        );
      }

      return tx.repuesto.update({
        where: { id },
        data: { activo: false },
        include: REPUESTO_DETAIL_INCLUDE,
      });
    });
    return this.mapRepuesto(updated);
  }

  // ============================================================
  // Stock — entrada y ajuste
  // ============================================================

  async entradaStock(
    tenantId: string,
    userId: string,
    repuestoId: string,
    dto: EntradaStockDto,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockRepuesto(tx, tenantId, repuestoId);

      const repuesto = await tx.repuesto.findFirst({
        where: { id: repuestoId, tenantId },
        include: { stock: true },
      });
      if (!repuesto) {
        throw new NotFoundException(
          `Repuesto con id "${repuestoId}" no encontrado`,
        );
      }
      if (!repuesto.activo) {
        throw new ConflictException(
          'No se puede registrar entrada sobre un repuesto inactivo',
        );
      }

      const stock = repuesto.stock!;
      const nuevoStockActual = stock.stockActual + dto.cantidad;

      await tx.inventarioStock.update({
        where: { id: stock.id },
        data: { stockActual: nuevoStockActual },
      });

      await tx.movimientoInventario.create({
        data: {
          tenantId,
          repuestoId,
          tipo: MovimientoInventarioTipo.ENTRADA,
          cantidad: dto.cantidad,
          stockResultante: nuevoStockActual,
          usuarioId: userId,
          observacion: dto.observacion,
        },
      });

      return tx.repuesto.findUniqueOrThrow({
        where: { id: repuestoId },
        include: REPUESTO_DETAIL_INCLUDE,
      });
    });
    return this.mapRepuesto(updated);
  }

  async ajusteStock(
    tenantId: string,
    userId: string,
    repuestoId: string,
    dto: AjusteStockDto,
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockRepuesto(tx, tenantId, repuestoId);

      const repuesto = await tx.repuesto.findFirst({
        where: { id: repuestoId, tenantId },
        include: { stock: true },
      });
      if (!repuesto) {
        throw new NotFoundException(
          `Repuesto con id "${repuestoId}" no encontrado`,
        );
      }
      if (!repuesto.activo) {
        throw new ConflictException(
          'No se puede ajustar stock de un repuesto inactivo',
        );
      }
      const stock = repuesto.stock!;

      if (dto.nuevoStockActual < stock.stockReservado) {
        throw new ConflictException(
          `No se puede ajustar a ${dto.nuevoStockActual}: hay ${stock.stockReservado} unidades reservadas`,
        );
      }

      const delta = dto.nuevoStockActual - stock.stockActual;
      await tx.inventarioStock.update({
        where: { id: stock.id },
        data: { stockActual: dto.nuevoStockActual },
      });

      await tx.movimientoInventario.create({
        data: {
          tenantId,
          repuestoId,
          tipo: MovimientoInventarioTipo.AJUSTE,
          cantidad: delta,
          stockResultante: dto.nuevoStockActual,
          usuarioId: userId,
          observacion: dto.observacion,
        },
      });

      return tx.repuesto.findUniqueOrThrow({
        where: { id: repuestoId },
        include: REPUESTO_DETAIL_INCLUDE,
      });
    });
    return this.mapRepuesto(updated);
  }

  // ============================================================
  // Movimientos
  // ============================================================

  async findAllMovimientos(tenantId: string, query: ListMovimientosQueryDto) {
    const { page = 1, limit = 20, repuestoId, ticketId, reservaId, tipo, desde, hasta } =
      query;

    if (desde && hasta && desde > hasta) {
      throw new BadRequestException(
        'El rango de fechas es invalido: "desde" no puede ser posterior a "hasta"',
      );
    }

    const where: Prisma.MovimientoInventarioWhereInput = {
      tenantId,
      ...(repuestoId && { repuestoId }),
      ...(ticketId && { ticketId }),
      ...(reservaId && { reservaId }),
      ...(tipo && { tipo }),
      ...((desde || hasta) && {
        createdAt: {
          ...(desde && { gte: desde }),
          ...(hasta && { lte: hasta }),
        },
      }),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.movimientoInventario.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: getPrismaSkip(page, limit),
        take: limit,
        include: {
          repuesto: { select: { id: true, codigo: true, nombre: true, unidad: true } },
        },
      }),
      this.prisma.movimientoInventario.count({ where }),
    ]);

    return buildPaginatedResult(rows, total, page, limit);
  }

  // ============================================================
  // Reservas
  // ============================================================

  async createReserva(
    tenantId: string,
    user: AuthUser,
    ticketId: string,
    dto: CreateReservaDto,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true, estado: true, mecanicoId: true, codigo: true },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket con id "${ticketId}" no encontrado`);
    }
    if (TICKET_ESTADOS_TERMINALES.includes(ticket.estado)) {
      throw new ConflictException(
        `No se pueden reservar repuestos para un ticket en estado ${ticket.estado}`,
      );
    }
    this.assertCanActOnTicket(user, ticket.mecanicoId);

    // Deduplicar items por repuestoId (sumar cantidades) y ordenar para evitar
    // deadlocks cuando se toman múltiples locks dentro de la TX.
    const agg = new Map<string, number>();
    for (const it of dto.items) {
      if (it.cantidad <= 0) {
        throw new BadRequestException('La cantidad debe ser mayor a 0');
      }
      agg.set(it.repuestoId, (agg.get(it.repuestoId) ?? 0) + it.cantidad);
    }
    const items = Array.from(agg.entries())
      .map(([repuestoId, cantidad]) => ({ repuestoId, cantidad }))
      .sort((a, b) => a.repuestoId.localeCompare(b.repuestoId));

    return this.prisma.$transaction(async (tx) => {
      // Locks por repuesto en orden lexicográfico → previene deadlock.
      for (const it of items) {
        await this.lockRepuesto(tx, tenantId, it.repuestoId);
      }

      // Cargar repuestos + stock y validar atomicidad.
      const repuestos = await tx.repuesto.findMany({
        where: { id: { in: items.map((i) => i.repuestoId) }, tenantId },
        include: { stock: true },
      });
      if (repuestos.length !== items.length) {
        throw new NotFoundException('Alguno de los repuestos no existe en el tenant');
      }
      const byId = new Map(repuestos.map((r) => [r.id, r]));
      for (const it of items) {
        const r = byId.get(it.repuestoId)!;
        if (!r.activo) {
          throw new ConflictException(
            `El repuesto "${r.codigo}" está inactivo y no puede reservarse`,
          );
        }
        const stock = r.stock!;
        const disponible = stock.stockActual - stock.stockReservado;
        if (it.cantidad > disponible) {
          throw new ConflictException(
            `Stock insuficiente para "${r.codigo}": disponible ${disponible}, solicitado ${it.cantidad}`,
          );
        }
      }

      // Si mechanic pide `solicitar: true`, la reserva queda en SOLICITADA y
      // NO consume stockReservado hasta que admin/jefe la apruebe via
      // POST /reservas-repuestos/:id/aprobar. Para admin/jefe el campo se
      // ignora y la reserva se crea directamente RESERVADA.
      const esSolicitud =
        dto.solicitar === true && user.role === 'mechanic';
      const estadoInicial = esSolicitud
        ? ReservaRepuestoEstado.SOLICITADA
        : ReservaRepuestoEstado.RESERVADA;

      const reserva = await tx.reservaRepuesto.create({
        data: {
          tenantId,
          ticketId,
          estado: estadoInicial,
          creadoPorId: user.id,
          observacion: dto.observacion,
          items: {
            create: items.map((it) => ({
              repuestoId: it.repuestoId,
              cantidad: it.cantidad,
            })),
          },
        },
        include: RESERVA_DETAIL_INCLUDE,
      });

      // SOLICITADA salta el update de stockReservado y la emision de
      // movimientos. Eso ocurrira en aprobarReserva al pasar a RESERVADA.
      if (!esSolicitud) {
        for (const it of items) {
          const r = byId.get(it.repuestoId)!;
          const stock = r.stock!;
          const nuevoReservado = stock.stockReservado + it.cantidad;
          await tx.inventarioStock.update({
            where: { id: stock.id },
            data: { stockReservado: nuevoReservado },
          });
          await tx.movimientoInventario.create({
            data: {
              tenantId,
              repuestoId: it.repuestoId,
              tipo: MovimientoInventarioTipo.RESERVA,
              cantidad: it.cantidad,
              stockResultante: stock.stockActual,
              usuarioId: user.id,
              ticketId,
              reservaId: reserva.id,
              observacion: dto.observacion,
            },
          });
        }
      }

      return reserva;
    });
  }

  /**
   * Listado global de reservas en estado SOLICITADA del tenant (admin/jefe).
   * Sin paginacion — el volumen esperado es bajo. Si crece, paginar.
   */
  async findReservasPendientes(tenantId: string) {
    return this.prisma.reservaRepuesto.findMany({
      where: { tenantId, estado: ReservaRepuestoEstado.SOLICITADA },
      include: {
        ...RESERVA_DETAIL_INCLUDE,
        ticket: { select: { id: true, codigo: true, titulo: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // tope defensivo; el volumen esperado de SOLICITADA es bajo.
    });
  }

  /**
   * Aprobar una reserva SOLICITADA → RESERVADA.
   * - Roles: admin, jefe_taller (validado por @Roles en el controller).
   * - Re-valida stock disponible (puede haber cambiado entre solicitud y
   *   aprobacion).
   * - Aplica stockReservado por item y emite movimiento RESERVA por item.
   * - Setea aprobadoPorId = user.id.
   */
  async aprobarReserva(
    tenantId: string,
    user: AuthUser,
    reservaId: string,
    dto: { observacion?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const reserva = await tx.reservaRepuesto.findFirst({
        where: { id: reservaId, tenantId },
        include: {
          items: true,
          ticket: { select: { id: true, mecanicoId: true, estado: true } },
        },
      });
      if (!reserva) {
        throw new NotFoundException(
          `Reserva con id "${reservaId}" no encontrada`,
        );
      }
      if (reserva.estado !== ReservaRepuestoEstado.SOLICITADA) {
        throw new ConflictException(
          `Solo se pueden aprobar reservas en estado SOLICITADA (actual: ${reserva.estado})`,
        );
      }
      // No aprobar reservas de tickets ya terminales: consumiria stockReservado
      // contra un ticket que nunca usara los repuestos (quedaria colgado).
      if (TICKET_ESTADOS_TERMINALES.includes(reserva.ticket.estado)) {
        throw new ConflictException(
          `No se puede aprobar una reserva de un ticket en estado ${reserva.ticket.estado}`,
        );
      }

      // Locks ordenados antes de leer/mutar stocks.
      const sortedItems = [...reserva.items].sort((a, b) =>
        a.repuestoId.localeCompare(b.repuestoId),
      );
      for (const it of sortedItems) {
        await this.lockRepuesto(tx, tenantId, it.repuestoId);
      }

      // Re-validar stock disponible item por item.
      const repuestos = await tx.repuesto.findMany({
        where: {
          id: { in: sortedItems.map((i) => i.repuestoId) },
          tenantId,
        },
        include: { stock: true },
      });
      const byId = new Map(repuestos.map((r) => [r.id, r]));
      for (const it of sortedItems) {
        const r = byId.get(it.repuestoId);
        if (!r) {
          throw new NotFoundException(
            'Alguno de los repuestos de la reserva no existe en el tenant',
          );
        }
        if (!r.activo) {
          throw new ConflictException(
            `El repuesto "${r.codigo}" esta inactivo`,
          );
        }
        const stock = r.stock!;
        const disponible = stock.stockActual - stock.stockReservado;
        if (it.cantidad > disponible) {
          throw new ConflictException(
            `Stock insuficiente para "${r.codigo}": disponible ${disponible}, requerido ${it.cantidad}`,
          );
        }
      }

      // Aplicar stockReservado + movimientos RESERVA.
      for (const it of sortedItems) {
        const r = byId.get(it.repuestoId)!;
        const stock = r.stock!;
        const nuevoReservado = stock.stockReservado + it.cantidad;
        await tx.inventarioStock.update({
          where: { id: stock.id },
          data: { stockReservado: nuevoReservado },
        });
        await tx.movimientoInventario.create({
          data: {
            tenantId,
            repuestoId: it.repuestoId,
            tipo: MovimientoInventarioTipo.RESERVA,
            cantidad: it.cantidad,
            stockResultante: stock.stockActual,
            usuarioId: user.id,
            ticketId: reserva.ticketId,
            reservaId: reserva.id,
            observacion: dto.observacion,
          },
        });
      }

      return tx.reservaRepuesto.update({
        where: { id: reservaId },
        data: {
          estado: ReservaRepuestoEstado.RESERVADA,
          aprobadoPorId: user.id,
        },
        include: RESERVA_DETAIL_INCLUDE,
      });
    });
  }

  async findReservasByTicket(
    tenantId: string,
    user: AuthUser,
    ticketId: string,
  ) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { id: true, mecanicoId: true },
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket con id "${ticketId}" no encontrado`);
    }
    this.assertCanActOnTicket(user, ticket.mecanicoId);

    return this.prisma.reservaRepuesto.findMany({
      where: { tenantId, ticketId },
      include: RESERVA_DETAIL_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 200, // tope defensivo; un ticket no deberia tener tantas reservas.
    });
  }

  async liberarReserva(
    tenantId: string,
    user: AuthUser,
    reservaId: string,
    dto: ReservaActionDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const reserva = await tx.reservaRepuesto.findFirst({
        where: { id: reservaId, tenantId },
        include: {
          items: true,
          ticket: { select: { id: true, mecanicoId: true } },
        },
      });
      if (!reserva) {
        throw new NotFoundException(
          `Reserva con id "${reservaId}" no encontrada`,
        );
      }
      this.assertCanActOnTicket(user, reserva.ticket.mecanicoId);

      if (
        reserva.estado !== ReservaRepuestoEstado.RESERVADA &&
        reserva.estado !== ReservaRepuestoEstado.SOLICITADA
      ) {
        throw new ConflictException(
          `Solo se pueden liberar reservas en estado RESERVADA o SOLICITADA (actual: ${reserva.estado})`,
        );
      }

      // Locks ordenados antes de mutar stocks.
      const sortedItems = [...reserva.items].sort((a, b) =>
        a.repuestoId.localeCompare(b.repuestoId),
      );
      for (const it of sortedItems) {
        await this.lockRepuesto(tx, tenantId, it.repuestoId);
      }

      // Si estaba RESERVADA, devolver stockReservado. SOLICITADA no consumió stockReservado.
      if (reserva.estado === ReservaRepuestoEstado.RESERVADA) {
        for (const it of sortedItems) {
          const stock = await tx.inventarioStock.findUnique({
            where: { repuestoId: it.repuestoId },
          });
          if (!stock) continue;
          const nuevoReservado = Math.max(0, stock.stockReservado - it.cantidad);
          await tx.inventarioStock.update({
            where: { id: stock.id },
            data: { stockReservado: nuevoReservado },
          });
          await tx.movimientoInventario.create({
            data: {
              tenantId,
              repuestoId: it.repuestoId,
              tipo: MovimientoInventarioTipo.LIBERACION,
              cantidad: -it.cantidad,
              stockResultante: stock.stockActual,
              usuarioId: user.id,
              ticketId: reserva.ticketId,
              reservaId: reserva.id,
              observacion: dto.observacion,
            },
          });
        }
      }

      return tx.reservaRepuesto.update({
        where: { id: reservaId },
        data: { estado: ReservaRepuestoEstado.LIBERADA },
        include: RESERVA_DETAIL_INCLUDE,
      });
    });
  }

  async consumirReserva(
    tenantId: string,
    user: AuthUser,
    reservaId: string,
    dto: ReservaActionDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const reserva = await tx.reservaRepuesto.findFirst({
        where: { id: reservaId, tenantId },
        include: {
          items: true,
          ticket: { select: { id: true, mecanicoId: true } },
        },
      });
      if (!reserva) {
        throw new NotFoundException(
          `Reserva con id "${reservaId}" no encontrada`,
        );
      }
      this.assertCanActOnTicket(user, reserva.ticket.mecanicoId);

      if (reserva.estado !== ReservaRepuestoEstado.RESERVADA) {
        throw new ConflictException(
          `Solo se pueden consumir reservas en estado RESERVADA (actual: ${reserva.estado})`,
        );
      }

      const sortedItems = [...reserva.items].sort((a, b) =>
        a.repuestoId.localeCompare(b.repuestoId),
      );
      for (const it of sortedItems) {
        await this.lockRepuesto(tx, tenantId, it.repuestoId);
      }

      for (const it of sortedItems) {
        const stock = await tx.inventarioStock.findUnique({
          where: { repuestoId: it.repuestoId },
        });
        if (!stock) {
          throw new ConflictException(
            'Inconsistencia: stock no encontrado para un item de la reserva',
          );
        }
        if (stock.stockActual < it.cantidad) {
          throw new ConflictException(
            `Stock insuficiente para consumir: ${stock.stockActual} < ${it.cantidad}`,
          );
        }
        const nuevoActual = stock.stockActual - it.cantidad;
        const nuevoReservado = Math.max(0, stock.stockReservado - it.cantidad);
        await tx.inventarioStock.update({
          where: { id: stock.id },
          data: { stockActual: nuevoActual, stockReservado: nuevoReservado },
        });
        await tx.movimientoInventario.create({
          data: {
            tenantId,
            repuestoId: it.repuestoId,
            tipo: MovimientoInventarioTipo.CONSUMO,
            cantidad: -it.cantidad,
            stockResultante: nuevoActual,
            usuarioId: user.id,
            ticketId: reserva.ticketId,
            reservaId: reserva.id,
            observacion: dto.observacion,
          },
        });
      }

      return tx.reservaRepuesto.update({
        where: { id: reservaId },
        data: { estado: ReservaRepuestoEstado.CONSUMIDA },
        include: RESERVA_DETAIL_INCLUDE,
      });
    });
  }

  /**
   * Libera las reservas activas (RESERVADA / SOLICITADA) de un ticket dentro de
   * una transaccion existente. Pensado para invocarse desde el cierre o la
   * cancelacion de un ticket/OT: cualquier stock reservado que no se haya
   * consumido explicitamente (via consumirReserva) se devuelve a disponible,
   * evitando que stockReservado quede colgado para siempre.
   *
   * - RESERVADA: devuelve stockReservado y emite movimiento LIBERACION.
   * - SOLICITADA: no tenia stockReservado aplicado; solo se marca LIBERADA.
   *
   * Idempotente: si el ticket no tiene reservas activas, no hace nada.
   * Toma lockRepuesto por item (orden lexicografico) para serializar contra
   * operaciones concurrentes de stock del mismo SKU.
   */
  async liberarReservasDeTicket(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ticketId: string,
    usuarioId: string,
  ): Promise<void> {
    const reservas = await tx.reservaRepuesto.findMany({
      where: {
        tenantId,
        ticketId,
        estado: {
          in: [
            ReservaRepuestoEstado.RESERVADA,
            ReservaRepuestoEstado.SOLICITADA,
          ],
        },
      },
      include: { items: true },
    });
    if (reservas.length === 0) return;

    for (const reserva of reservas) {
      const sortedItems = [...reserva.items].sort((a, b) =>
        a.repuestoId.localeCompare(b.repuestoId),
      );
      for (const it of sortedItems) {
        await this.lockRepuesto(tx, tenantId, it.repuestoId);
      }

      if (reserva.estado === ReservaRepuestoEstado.RESERVADA) {
        for (const it of sortedItems) {
          const stock = await tx.inventarioStock.findUnique({
            where: { repuestoId: it.repuestoId },
          });
          if (!stock) continue;
          const nuevoReservado = Math.max(
            0,
            stock.stockReservado - it.cantidad,
          );
          await tx.inventarioStock.update({
            where: { id: stock.id },
            data: { stockReservado: nuevoReservado },
          });
          await tx.movimientoInventario.create({
            data: {
              tenantId,
              repuestoId: it.repuestoId,
              tipo: MovimientoInventarioTipo.LIBERACION,
              cantidad: -it.cantidad,
              stockResultante: stock.stockActual,
              usuarioId,
              ticketId,
              reservaId: reserva.id,
              observacion: 'Liberacion automatica por cierre/cancelacion del ticket',
            },
          });
        }
      }

      await tx.reservaRepuesto.update({
        where: { id: reserva.id },
        data: { estado: ReservaRepuestoEstado.LIBERADA },
      });
    }
  }

  // ============================================================
  // Helpers privados
  // ============================================================

  /**
   * Verifica que el usuario pueda operar sobre un ticket dado.
   * admin / jefe_taller: siempre (dentro del tenant).
   * mechanic: solo si el ticket le pertenece.
   */
  private assertCanActOnTicket(
    user: AuthUser,
    ticketMecanicoId: string | null,
  ): void {
    if (user.role === 'admin' || user.role === 'jefe_taller') return;
    if (user.role === 'mechanic' && ticketMecanicoId === user.id) return;
    throw new ForbiddenException('Sin acceso al ticket indicado');
  }

  /**
   * Toma un advisory lock por repuesto/tenant dentro de la transacción.
   * Sirve para serializar lecturas/escrituras de stock del mismo SKU.
   * El lock se libera automáticamente al commit/rollback.
   *
   * Usamos `hashtextextended` (PG11+) que devuelve int8 — menos colisiones
   * que `hashtext` (int4) cuando hay muchos repuestos en el mismo tenant.
   */
  private async lockRepuesto(
    tx: Prisma.TransactionClient,
    tenantId: string,
    repuestoId: string,
  ): Promise<void> {
    const key = `inv:${tenantId}:${repuestoId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }

  /**
   * Valida que la marca exista en el tenant, esté activa y tenga ámbito
   * REPUESTO o AMBOS. 404 si no existe o es de otro tenant (mismo mensaje,
   * no filtra existencia); 409 si existe pero no es usable.
   */
  private async assertMarcaUsable(
    tenantId: string,
    marcaId: string,
  ): Promise<void> {
    const marca = await this.prisma.marca.findFirst({
      where: { id: marcaId, tenantId },
      select: { id: true, nombre: true, tipo: true, activo: true },
    });
    if (!marca) {
      throw new NotFoundException(
        `Marca con id "${marcaId}" no encontrada en el tenant`,
      );
    }
    if (!marca.activo) {
      throw new ConflictException(
        `La marca "${marca.nombre}" está inactiva y no puede asignarse`,
      );
    }
    if (marca.tipo === MarcaTipo.EQUIPO) {
      throw new ConflictException(
        `La marca "${marca.nombre}" es de ámbito EQUIPO y no aplica a repuestos`,
      );
    }
  }

  private mapRepuesto(
    repuesto: Prisma.RepuestoGetPayload<{ include: typeof REPUESTO_DETAIL_INCLUDE }>,
  ) {
    const stockActual = repuesto.stock?.stockActual ?? 0;
    const stockReservado = repuesto.stock?.stockReservado ?? 0;
    const stockDisponible = stockActual - stockReservado;
    return {
      id: repuesto.id,
      codigo: repuesto.codigo,
      nombre: repuesto.nombre,
      descripcion: repuesto.descripcion,
      categoria: repuesto.categoria,
      unidad: repuesto.unidad,
      stockMinimo: repuesto.stockMinimo,
      marca: repuesto.marca
        ? { id: repuesto.marca.id, nombre: repuesto.marca.nombre }
        : null,
      marcaId: repuesto.marcaId,
      codigoFabricante: repuesto.codigoFabricante,
      ubicacionBodega: repuesto.ubicacionBodega,
      proveedor: repuesto.proveedor,
      activo: repuesto.activo,
      metadata: repuesto.metadata,
      stockActual,
      stockReservado,
      stockDisponible,
      bajoStock: stockDisponible <= repuesto.stockMinimo,
      createdAt: repuesto.createdAt,
      updatedAt: repuesto.updatedAt,
    };
  }
}

