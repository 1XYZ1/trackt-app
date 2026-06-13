import { BadRequestException } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { PrismaService } from '../prisma/prisma.service';
import { EquiposService } from '../equipos/equipos.service';
import { ProfileService } from '../auth/profile.service';
import { toCsv } from './csv.util';

function buildPrismaMock() {
  return {
    equipo: {
      findMany: jest.fn(),
    },
    ordenTrabajo: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    ticket: {
      findMany: jest.fn(),
    },
    repuesto: {
      findMany: jest.fn(),
    },
    movimientoInventario: {
      groupBy: jest.fn(),
    },
    programacionMantenimiento: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function buildEquiposMock() {
  return { historial: jest.fn() };
}

function buildProfilesMock() {
  return { getUserSummaries: jest.fn() };
}

const TENANT = 'tenant-1';
const EQUIPO_ID = 'eq-1';

describe('ReportesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let equipos: ReturnType<typeof buildEquiposMock>;
  let profiles: ReturnType<typeof buildProfilesMock>;
  let service: ReportesService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    equipos = buildEquiposMock();
    profiles = buildProfilesMock();
    service = new ReportesService(
      prisma as unknown as PrismaService,
      equipos as unknown as EquiposService,
      profiles as unknown as ProfileService,
    );
  });

  // ---------- equipos ----------

  describe('reporteEquipos', () => {
    it('filtra por tenant y ordena por total de OTs (equipos con más fallas)', async () => {
      prisma.equipo.findMany.mockResolvedValue([
        { id: 'eq-1', codigo: 'EQ-001', nombre: 'A' },
        { id: 'eq-2', codigo: 'EQ-002', nombre: 'B' },
      ]);
      prisma.ordenTrabajo.groupBy.mockResolvedValue([
        { equipoId: 'eq-1', estado: 'CERRADA', _count: { _all: 2 } },
        { equipoId: 'eq-2', estado: 'EN_PROCESO', _count: { _all: 5 } },
        { equipoId: 'eq-2', estado: 'CERRADA', _count: { _all: 3 } },
      ]);
      prisma.programacionMantenimiento.groupBy.mockResolvedValue([
        { equipoId: 'eq-1', _count: { _all: 1 } },
      ]);

      const reporte = await service.reporteEquipos(TENANT);

      expect(prisma.equipo.findMany.mock.calls[0][0].where).toEqual({
        tenantId: TENANT,
      });
      expect(prisma.ordenTrabajo.groupBy.mock.calls[0][0].where).toEqual({
        tenantId: TENANT,
      });
      // eq-2 tiene 8 OTs → primera fila ("más fallas").
      expect(reporte.rows[0]).toMatchObject({
        codigo: 'EQ-002',
        totalOrdenes: 8,
        ordenesAbiertas: 5,
        ordenesCerradas: 3,
      });
      expect(reporte.rows[1]).toMatchObject({
        codigo: 'EQ-001',
        totalOrdenes: 2,
        programacionesPendientes: 1,
      });
    });
  });

  // ---------- ordenes ----------

  describe('reporteOrdenes', () => {
    it('filtra por tenant, estado y rango de fechas', async () => {
      prisma.ordenTrabajo.findMany.mockResolvedValue([
        {
          codigo: 'OT-2026-0001',
          descripcion: 'Mantención',
          prioridad: 'MEDIA',
          estado: 'CERRADA',
          createdAt: new Date(),
          fechaCierre: new Date(),
          equipo: { codigo: 'EQ-001', nombre: 'Compresor' },
          _count: { tickets: 2 },
        },
      ]);

      const reporte = await service.reporteOrdenes(TENANT, {
        desde: '2026-06-01',
        hasta: '2026-06-30',
        estado: 'CERRADA',
      });

      const where = prisma.ordenTrabajo.findMany.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT);
      expect(where.estado).toBe('CERRADA');
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(reporte.rows[0]).toMatchObject({
        codigo: 'OT-2026-0001',
        equipo: 'EQ-001 - Compresor',
        tickets: 2,
      });
    });

    it('400 si el rango está invertido', async () => {
      await expect(
        service.reporteOrdenes(TENANT, {
          desde: '2026-07-01',
          hasta: '2026-06-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ---------- tickets ----------

  describe('reporteTickets', () => {
    it('filtra por tenant, estado y mecánico, e hidrata nombres', async () => {
      prisma.ticket.findMany.mockResolvedValue([
        {
          codigo: 'TKT-2026-0001',
          titulo: 'Cambio de filtro',
          estado: 'ASIGNADO',
          prioridad: 'ALTA',
          mecanicoId: 'mec-1',
          createdAt: new Date(),
          fechaCierre: null,
          ot: {
            codigo: 'OT-2026-0001',
            equipo: { codigo: 'EQ-001', nombre: 'Compresor' },
          },
        },
      ]);
      profiles.getUserSummaries.mockResolvedValue(
        new Map([['mec-1', { id: 'mec-1', nombre: 'Mecánico Uno' }]]),
      );

      const reporte = await service.reporteTickets(TENANT, {
        estado: 'ASIGNADO',
        mecanicoId: 'mec-1',
      });

      const where = prisma.ticket.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({
        tenantId: TENANT,
        estado: 'ASIGNADO',
        mecanicoId: 'mec-1',
      });
      expect(reporte.rows[0].mecanico).toBe('Mecánico Uno');
    });
  });

  // ---------- inventario ----------

  describe('reporteInventario', () => {
    it('vista stock: calcula disponible y marca críticos; soloCriticos filtra', async () => {
      prisma.repuesto.findMany.mockResolvedValue([
        {
          codigo: 'FILTRO-001',
          nombre: 'Filtro',
          categoria: 'filtros',
          unidad: 'unidad',
          stockMinimo: 5,
          activo: true,
          stock: { stockActual: 10, stockReservado: 7 }, // disponible 3 ≤ 5 → crítico
        },
        {
          codigo: 'ACEITE-001',
          nombre: 'Aceite',
          categoria: 'lubricantes',
          unidad: 'litro',
          stockMinimo: 2,
          activo: true,
          stock: { stockActual: 20, stockReservado: 0 },
        },
      ]);

      const completo = await service.reporteInventario(TENANT, {});
      expect(prisma.repuesto.findMany.mock.calls[0][0].where).toEqual({
        tenantId: TENANT,
      });
      expect(completo.rows).toHaveLength(2);
      expect(completo.rows[0]).toMatchObject({
        codigo: 'FILTRO-001',
        stockDisponible: 3,
        critico: true,
      });

      const criticos = await service.reporteInventario(TENANT, {
        soloCriticos: true,
      });
      expect(criticos.rows).toHaveLength(1);
      expect(criticos.rows[0].codigo).toBe('FILTRO-001');
      expect(criticos.filename).toBe('stock-critico');
    });

    it('vista consumos por equipo: agrupa CONSUMO navegando ticket→ot→equipo', async () => {
      prisma.movimientoInventario.groupBy.mockResolvedValue([
        { repuestoId: 'rep-1', _sum: { cantidad: -12 }, _count: { _all: 4 } },
        { repuestoId: 'rep-2', _sum: { cantidad: -30 }, _count: { _all: 2 } },
      ]);
      prisma.repuesto.findMany.mockResolvedValue([
        {
          id: 'rep-1',
          codigo: 'FILTRO-001',
          nombre: 'Filtro',
          unidad: 'unidad',
        },
        {
          id: 'rep-2',
          codigo: 'ACEITE-001',
          nombre: 'Aceite',
          unidad: 'litro',
        },
      ]);

      const reporte = await service.reporteInventario(TENANT, {
        vista: 'consumos',
        equipoId: EQUIPO_ID,
      });

      const args = prisma.movimientoInventario.groupBy.mock.calls[0][0];
      expect(args.where).toMatchObject({
        tenantId: TENANT,
        tipo: 'CONSUMO',
        ticket: { ot: { equipoId: EQUIPO_ID } },
      });
      // Orden descendente por unidades (más consumidos primero), en valor absoluto.
      expect(reporte.rows[0]).toMatchObject({
        codigo: 'ACEITE-001',
        unidadesConsumidas: 30,
      });
      expect(reporte.rows[1]).toMatchObject({
        codigo: 'FILTRO-001',
        unidadesConsumidas: 12,
        movimientos: 4,
      });
      // El lookup de nombres también va scoped por tenant.
      expect(prisma.repuesto.findMany.mock.calls[0][0].where).toMatchObject({
        tenantId: TENANT,
      });
    });
  });

  // ---------- mantenimientos ----------

  describe('reporteMantenimientos', () => {
    it('vista vencidos: PROGRAMADA con fecha pasada y días de atraso', async () => {
      const hace3dias = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      prisma.programacionMantenimiento.findMany.mockResolvedValue([
        {
          titulo: 'Mantención mensual',
          fechaProgramada: hace3dias,
          estado: 'PROGRAMADA',
          prioridad: 'MEDIA',
          recurrencia: 'mensual',
          equipo: { codigo: 'EQ-001', nombre: 'Compresor' },
          plantilla: { nombre: 'Plantilla mensual' },
        },
      ]);

      const reporte = await service.reporteMantenimientos(TENANT, {
        vista: 'vencidos',
      });

      const where =
        prisma.programacionMantenimiento.findMany.mock.calls[0][0].where;
      expect(where.tenantId).toBe(TENANT);
      expect(where.estado).toBe('PROGRAMADA');
      expect(where.fechaProgramada.lt).toBeInstanceOf(Date);
      expect(reporte.rows[0].diasAtraso).toBe(3);
      expect(reporte.filename).toBe('mantenimientos-vencidos');
    });

    it('vista proximos: PROGRAMADA con fecha futura', async () => {
      prisma.programacionMantenimiento.findMany.mockResolvedValue([]);

      await service.reporteMantenimientos(TENANT, { vista: 'proximos' });

      const where =
        prisma.programacionMantenimiento.findMany.mock.calls[0][0].where;
      expect(where.estado).toBe('PROGRAMADA');
      expect(where.fechaProgramada.gte).toBeInstanceOf(Date);
    });
  });

  // ---------- historial por equipo ----------

  describe('reporteHistorialEquipo', () => {
    it('delega en EquiposService.historial y aplana la línea de tiempo', async () => {
      equipos.historial.mockResolvedValue({
        equipo: { codigo: 'EQ-001' },
        ordenes: [
          {
            codigo: 'OT-2026-0001',
            descripcion: 'Mantención',
            estado: 'CERRADA',
            createdAt: new Date('2026-06-02T10:00:00Z'),
          },
        ],
        tickets: [
          {
            codigo: 'TKT-2026-0001',
            titulo: 'Cambio filtro',
            estado: 'CERRADO',
            createdAt: new Date('2026-06-03T10:00:00Z'),
          },
        ],
        reservas: [],
        movimientos: [],
        evidencias: [],
        programaciones: [],
        repuestosConsumidos: [],
      });

      const { historial, tabular } = await service.reporteHistorialEquipo(
        TENANT,
        EQUIPO_ID,
        { desde: '2026-06-01' },
      );

      expect(equipos.historial).toHaveBeenCalledWith(TENANT, EQUIPO_ID, {
        desde: '2026-06-01',
        hasta: undefined,
        estado: undefined,
      });
      expect(historial.equipo.codigo).toBe('EQ-001');
      // Timeline descendente: el ticket (06-03) antes que la OT (06-02).
      expect(tabular.rows[0]).toMatchObject({ tipo: 'TICKET' });
      expect(tabular.rows[1]).toMatchObject({ tipo: 'OT' });
      expect(tabular.filename).toBe('historial-EQ-001');
    });
  });

  // ---------- csv ----------

  describe('toCsv', () => {
    it('escapa comas, comillas y saltos de línea; incluye BOM', () => {
      const csv = toCsv(
        ['codigo', 'nombre'],
        [
          { codigo: 'A-1', nombre: 'Filtro, grande' },
          { codigo: 'B-2', nombre: 'Marca "X"' },
        ],
      );

      expect(csv.charCodeAt(0)).toBe(0xfeff);
      const lineas = csv.slice(1).split('\r\n');
      expect(lineas[0]).toBe('codigo,nombre');
      expect(lineas[1]).toBe('A-1,"Filtro, grande"');
      expect(lineas[2]).toBe('B-2,"Marca ""X"""');
    });
  });
});
