import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MovimientoInventarioTipo,
  OrdenTrabajoEstado,
  Prisma,
  ProgramacionMantenimientoEstado,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EquiposService } from '../equipos/equipos.service';
import { ProfileService } from '../auth/profile.service';
import {
  ReporteHistorialQueryDto,
  ReporteInventarioQueryDto,
  ReporteMantenimientosQueryDto,
  ReporteOrdenesQueryDto,
  ReporteTicketsQueryDto,
} from './dto/reportes-query.dto';

// Forma común de todo reporte tabular: el controller decide si lo sirve
// como JSON (rows) o CSV (headers + rows).
export interface ReporteTabular {
  filename: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

const OT_ESTADOS_ABIERTOS: OrdenTrabajoEstado[] = [
  OrdenTrabajoEstado.PENDIENTE,
  OrdenTrabajoEstado.EN_PROCESO,
];

/**
 * Reportes descargables (Fase 6). Solo lecturas agregadas — la reserva
 * sigue viviendo en el ticket, la OT en el equipo: acá no se muta nada.
 */
@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly equipos: EquiposService,
    private readonly profiles: ProfileService,
  ) {}

  /**
   * Reporte de equipos con actividad agregada, ordenado por total de OTs
   * descendente — la primera fila es "el equipo con más fallas".
   */
  async reporteEquipos(tenantId: string): Promise<ReporteTabular> {
    // Promise.all (no $transaction): son lecturas agregadas y el tipado de
    // groupBy no sobrevive el array de PrismaPromises.
    const [equipos, otsPorEquipo, progsPendientes] = await Promise.all([
      this.prisma.equipo.findMany({
        where: { tenantId },
        select: {
          id: true,
          codigo: true,
          nombre: true,
          tipo: true,
          ubicacion: true,
          estadoOperativo: true,
          activo: true,
        },
        orderBy: { codigo: 'asc' },
      }),
      this.prisma.ordenTrabajo.groupBy({
        by: ['equipoId', 'estado'],
        where: { tenantId },
        _count: { _all: true },
        orderBy: { equipoId: 'asc' },
      }),
      this.prisma.programacionMantenimiento.groupBy({
        by: ['equipoId'],
        where: {
          tenantId,
          estado: ProgramacionMantenimientoEstado.PROGRAMADA,
        },
        _count: { _all: true },
        orderBy: { equipoId: 'asc' },
      }),
    ]);

    const stats = new Map<
      string,
      { total: number; abiertas: number; cerradas: number }
    >();
    for (const fila of otsPorEquipo) {
      const actual = stats.get(fila.equipoId) ?? {
        total: 0,
        abiertas: 0,
        cerradas: 0,
      };
      actual.total += fila._count._all;
      if (OT_ESTADOS_ABIERTOS.includes(fila.estado)) {
        actual.abiertas += fila._count._all;
      }
      if (fila.estado === OrdenTrabajoEstado.CERRADA) {
        actual.cerradas += fila._count._all;
      }
      stats.set(fila.equipoId, actual);
    }
    const pendientes = new Map(
      progsPendientes.map((p) => [p.equipoId, p._count._all]),
    );

    const rows = equipos
      .map((e) => ({
        codigo: e.codigo,
        nombre: e.nombre,
        tipo: e.tipo,
        ubicacion: e.ubicacion,
        estadoOperativo: e.estadoOperativo,
        activo: e.activo,
        totalOrdenes: stats.get(e.id)?.total ?? 0,
        ordenesAbiertas: stats.get(e.id)?.abiertas ?? 0,
        ordenesCerradas: stats.get(e.id)?.cerradas ?? 0,
        programacionesPendientes: pendientes.get(e.id) ?? 0,
      }))
      .sort((a, b) => b.totalOrdenes - a.totalOrdenes);

    return {
      filename: 'reporte-equipos',
      headers: [
        'codigo',
        'nombre',
        'tipo',
        'ubicacion',
        'estadoOperativo',
        'activo',
        'totalOrdenes',
        'ordenesAbiertas',
        'ordenesCerradas',
        'programacionesPendientes',
      ],
      rows,
    };
  }

  /**
   * Historial por equipo. JSON: el objeto completo de
   * EquiposService.historial. CSV: línea de tiempo aplanada.
   */
  async reporteHistorialEquipo(
    tenantId: string,
    equipoId: string,
    query: ReporteHistorialQueryDto,
  ) {
    const historial = await this.equipos.historial(tenantId, equipoId, {
      desde: query.desde,
      hasta: query.hasta,
      estado: query.estado,
    });

    const timeline: Record<string, unknown>[] = [
      ...historial.ordenes.map((o) => ({
        fecha: o.createdAt,
        tipo: 'OT',
        codigo: o.codigo,
        detalle: o.descripcion,
        estado: o.estado as string,
      })),
      ...historial.tickets.map((t) => ({
        fecha: t.createdAt,
        tipo: 'TICKET',
        codigo: t.codigo,
        detalle: t.titulo,
        estado: t.estado as string,
      })),
      ...historial.reservas.map((r) => ({
        fecha: r.createdAt,
        tipo: 'RESERVA',
        codigo: r.ticket.codigo,
        detalle: r.items
          .map((it) => `${it.repuesto.codigo} x${it.cantidad}`)
          .join('; '),
        estado: r.estado as string,
      })),
      ...historial.movimientos.map((m) => ({
        fecha: m.createdAt,
        tipo: `MOV_${m.tipo}`,
        codigo: m.repuesto.codigo,
        detalle: `${m.repuesto.nombre} (${m.cantidad})`,
        estado: '',
      })),
      ...historial.evidencias.map((e) => ({
        fecha: e.createdAt,
        tipo: 'EVIDENCIA',
        codigo: e.ticket.codigo,
        detalle: e.descripcion ?? e.storagePath,
        estado: '',
      })),
      ...historial.programaciones.map((p) => ({
        fecha: p.fechaProgramada,
        tipo: 'PROGRAMACION',
        codigo: '',
        detalle: p.titulo,
        estado: p.estado as string,
      })),
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    return {
      historial,
      tabular: {
        filename: `historial-${historial.equipo.codigo}`,
        headers: ['fecha', 'tipo', 'codigo', 'detalle', 'estado'],
        rows: timeline,
      } satisfies ReporteTabular,
    };
  }

  /** OTs por rango de fechas / estado. */
  async reporteOrdenes(
    tenantId: string,
    query: ReporteOrdenesQueryDto,
  ): Promise<ReporteTabular> {
    const rango = this.buildRango(query.desde, query.hasta);
    const ordenes = await this.prisma.ordenTrabajo.findMany({
      where: {
        tenantId,
        ...(query.estado && { estado: query.estado }),
        ...(rango && { createdAt: rango }),
      },
      select: {
        codigo: true,
        descripcion: true,
        prioridad: true,
        estado: true,
        createdAt: true,
        fechaCierre: true,
        equipo: { select: { codigo: true, nombre: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    return {
      filename: 'reporte-ordenes',
      headers: [
        'codigo',
        'equipo',
        'descripcion',
        'prioridad',
        'estado',
        'tickets',
        'fechaCreacion',
        'fechaCierre',
      ],
      rows: ordenes.map((o) => ({
        codigo: o.codigo,
        equipo: o.equipo ? `${o.equipo.codigo} - ${o.equipo.nombre}` : '',
        descripcion: o.descripcion,
        prioridad: o.prioridad,
        estado: o.estado,
        tickets: o._count.tickets,
        fechaCreacion: o.createdAt,
        fechaCierre: o.fechaCierre,
      })),
    };
  }

  /** Tickets por estado y/o mecánico. */
  async reporteTickets(
    tenantId: string,
    query: ReporteTicketsQueryDto,
  ): Promise<ReporteTabular> {
    const rango = this.buildRango(query.desde, query.hasta);
    const tickets = await this.prisma.ticket.findMany({
      where: {
        tenantId,
        ...(query.estado && { estado: query.estado }),
        ...(query.mecanicoId && { mecanicoId: query.mecanicoId }),
        ...(rango && { createdAt: rango }),
      },
      select: {
        codigo: true,
        titulo: true,
        estado: true,
        prioridad: true,
        mecanicoId: true,
        createdAt: true,
        fechaCierre: true,
        ot: {
          select: {
            codigo: true,
            equipo: { select: { codigo: true, nombre: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const nombres = await this.profiles.getUserSummaries(
      tickets.map((t) => t.mecanicoId).filter((v): v is string => Boolean(v)),
    );

    return {
      filename: 'reporte-tickets',
      headers: [
        'codigo',
        'titulo',
        'estado',
        'prioridad',
        'ot',
        'equipo',
        'mecanico',
        'fechaCreacion',
        'fechaCierre',
      ],
      rows: tickets.map((t) => ({
        codigo: t.codigo,
        titulo: t.titulo,
        estado: t.estado,
        prioridad: t.prioridad,
        ot: t.ot.codigo,
        equipo: t.ot.equipo
          ? `${t.ot.equipo.codigo} - ${t.ot.equipo.nombre}`
          : '',
        mecanico: t.mecanicoId
          ? (nombres.get(t.mecanicoId)?.nombre ?? t.mecanicoId)
          : '',
        fechaCreacion: t.createdAt,
        fechaCierre: t.fechaCierre,
      })),
    };
  }

  /**
   * Inventario. vista=stock: existencias (soloCriticos = stock crítico).
   * vista=consumos: unidades consumidas por repuesto, opcionalmente
   * acotado a un equipo — cubre "consumo por equipo" y "más consumidos".
   */
  async reporteInventario(
    tenantId: string,
    query: ReporteInventarioQueryDto,
  ): Promise<ReporteTabular> {
    if (query.vista === 'consumos') {
      return this.reporteConsumos(tenantId, query);
    }

    const repuestos = await this.prisma.repuesto.findMany({
      where: { tenantId },
      select: {
        codigo: true,
        nombre: true,
        categoria: true,
        unidad: true,
        stockMinimo: true,
        activo: true,
        stock: { select: { stockActual: true, stockReservado: true } },
      },
      orderBy: { codigo: 'asc' },
    });

    let rows = repuestos.map((r) => {
      const stockActual = r.stock?.stockActual ?? 0;
      const stockReservado = r.stock?.stockReservado ?? 0;
      const stockDisponible = stockActual - stockReservado;
      return {
        codigo: r.codigo,
        nombre: r.nombre,
        categoria: r.categoria,
        unidad: r.unidad,
        stockActual,
        stockReservado,
        stockDisponible,
        stockMinimo: r.stockMinimo,
        critico: stockDisponible <= r.stockMinimo,
        activo: r.activo,
      };
    });
    if (query.soloCriticos) {
      rows = rows.filter((r) => r.critico);
    }

    return {
      filename: query.soloCriticos ? 'stock-critico' : 'reporte-inventario',
      headers: [
        'codigo',
        'nombre',
        'categoria',
        'unidad',
        'stockActual',
        'stockReservado',
        'stockDisponible',
        'stockMinimo',
        'critico',
        'activo',
      ],
      rows,
    };
  }

  private async reporteConsumos(
    tenantId: string,
    query: ReporteInventarioQueryDto,
  ): Promise<ReporteTabular> {
    const rango = this.buildRango(query.desde, query.hasta);
    const agrupado = await this.prisma.movimientoInventario.groupBy({
      by: ['repuestoId'],
      where: {
        tenantId,
        tipo: MovimientoInventarioTipo.CONSUMO,
        ...(query.equipoId && {
          ticket: { ot: { equipoId: query.equipoId } },
        }),
        ...(rango && { createdAt: rango }),
      },
      _sum: { cantidad: true },
      _count: { _all: true },
      orderBy: { repuestoId: 'asc' },
    });

    const repuestos =
      agrupado.length > 0
        ? await this.prisma.repuesto.findMany({
            where: {
              id: { in: agrupado.map((a) => a.repuestoId) },
              tenantId,
            },
            select: { id: true, codigo: true, nombre: true, unidad: true },
          })
        : [];
    const porId = new Map(repuestos.map((r) => [r.id, r]));

    const rows = agrupado
      .map((a) => ({
        codigo: porId.get(a.repuestoId)?.codigo ?? a.repuestoId,
        nombre: porId.get(a.repuestoId)?.nombre ?? null,
        unidad: porId.get(a.repuestoId)?.unidad ?? null,
        // CONSUMO registra negativos → se reportan unidades.
        unidadesConsumidas: Math.abs(a._sum.cantidad ?? 0),
        movimientos: a._count._all,
      }))
      .sort((a, b) => b.unidadesConsumidas - a.unidadesConsumidas);

    return {
      filename: query.equipoId
        ? `consumo-equipo-${query.equipoId}`
        : 'repuestos-mas-consumidos',
      headers: [
        'codigo',
        'nombre',
        'unidad',
        'unidadesConsumidas',
        'movimientos',
      ],
      rows,
    };
  }

  /**
   * Mantenimientos programados. vista=vencidos: PROGRAMADA con fecha
   * pasada (con días de atraso). vista=proximos: PROGRAMADA futura.
   */
  async reporteMantenimientos(
    tenantId: string,
    query: ReporteMantenimientosQueryDto,
  ): Promise<ReporteTabular> {
    const ahora = new Date();
    const rango = this.buildRango(query.desde, query.hasta);

    const where: Prisma.ProgramacionMantenimientoWhereInput = {
      tenantId,
      ...(query.vista === 'vencidos' && {
        estado: ProgramacionMantenimientoEstado.PROGRAMADA,
        fechaProgramada: { lt: ahora },
      }),
      ...(query.vista === 'proximos' && {
        estado: ProgramacionMantenimientoEstado.PROGRAMADA,
        fechaProgramada: { gte: ahora, ...(rango?.lte && { lte: rango.lte }) },
      }),
      ...(query.vista !== 'vencidos' &&
        query.vista !== 'proximos' && {
          ...(query.estado && { estado: query.estado }),
          ...(rango && { fechaProgramada: rango }),
        }),
    };

    const programaciones = await this.prisma.programacionMantenimiento.findMany(
      {
        where,
        select: {
          titulo: true,
          fechaProgramada: true,
          estado: true,
          prioridad: true,
          recurrencia: true,
          equipo: { select: { codigo: true, nombre: true } },
          plantilla: { select: { nombre: true } },
        },
        orderBy: { fechaProgramada: 'asc' },
        take: 1000,
      },
    );

    const rows = programaciones.map((p) => ({
      titulo: p.titulo,
      equipo: `${p.equipo.codigo} - ${p.equipo.nombre}`,
      plantilla: p.plantilla?.nombre ?? '',
      fechaProgramada: p.fechaProgramada,
      estado: p.estado,
      prioridad: p.prioridad,
      recurrencia: p.recurrencia,
      ...(query.vista === 'vencidos' && {
        diasAtraso: Math.floor(
          (ahora.getTime() - p.fechaProgramada.getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      }),
    }));

    const headersBase = [
      'titulo',
      'equipo',
      'plantilla',
      'fechaProgramada',
      'estado',
      'prioridad',
      'recurrencia',
    ];
    return {
      filename:
        query.vista === 'vencidos'
          ? 'mantenimientos-vencidos'
          : query.vista === 'proximos'
            ? 'mantenimientos-proximos'
            : 'reporte-mantenimientos',
      headers:
        query.vista === 'vencidos'
          ? [...headersBase, 'diasAtraso']
          : headersBase,
      rows,
    };
  }

  // ---------- helpers ----------

  private buildRango(
    desde?: string,
    hasta?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!desde && !hasta) return undefined;
    const gte = desde ? new Date(desde) : undefined;
    const lte = hasta ? new Date(hasta) : undefined;
    if (gte && lte && gte > lte) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }
    return { ...(gte && { gte }), ...(lte && { lte }) };
  }
}
