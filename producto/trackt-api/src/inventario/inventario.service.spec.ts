import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  MovimientoInventarioTipo,
  ReservaRepuestoEstado,
  TicketEstado,
} from '@prisma/client';
import { InventarioService } from './inventario.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Mock de PrismaService para Inventario.
 * `$transaction` soporta callback (con tx-mock que delega en los mismos métodos)
 * y arrays (resuelve cada promise en orden).
 */
function buildPrismaMock() {
  const mock = {
    repuesto: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    inventarioStock: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reservaRepuesto: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    movimientoInventario: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    ticket: {
      findFirst: jest.fn(),
    },
    marca: {
      findFirst: jest.fn(),
    },
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
  };

  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: typeof mock) => Promise<unknown>)(mock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    throw new Error('Unexpected $transaction argument');
  });

  return mock;
}

const TENANT = 'tenant-1';
const REPUESTO_ID = 'rep-1';
const TICKET_ID = 'tk-1';
const ADMIN: any = { id: 'user-admin', role: 'admin', tenantId: TENANT };
const JEFE: any = { id: 'user-jefe', role: 'jefe_taller', tenantId: TENANT };
const MECH = (id = 'user-mech'): any => ({
  id,
  role: 'mechanic',
  tenantId: TENANT,
});

describe('InventarioService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: InventarioService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new InventarioService(prisma as unknown as PrismaService);
  });

  // ============================================================
  // Repuestos
  // ============================================================

  describe('createRepuesto', () => {
    it('crea repuesto + stock + movimiento ENTRADA cuando stockInicial > 0', async () => {
      prisma.repuesto.findUnique.mockResolvedValue(null);
      prisma.repuesto.create.mockResolvedValue({ id: REPUESTO_ID });
      prisma.inventarioStock.create.mockResolvedValue({});
      prisma.movimientoInventario.create.mockResolvedValue({});
      prisma.repuesto.findUniqueOrThrow.mockResolvedValue({
        id: REPUESTO_ID,
        codigo: 'FILTRO-001',
        nombre: 'Filtro',
        unidad: 'unidad',
        stockMinimo: 0,
        activo: true,
        descripcion: null,
        categoria: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        stock: { stockActual: 10, stockReservado: 0 },
      });

      const result = await service.createRepuesto(TENANT, ADMIN.id, {
        codigo: 'FILTRO-001',
        nombre: 'Filtro',
        stockInicial: 10,
      });

      expect(prisma.repuesto.create).toHaveBeenCalledTimes(1);
      expect(prisma.inventarioStock.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TENANT,
          stockActual: 10,
          stockReservado: 0,
        }),
      });
      const movArgs = prisma.movimientoInventario.create.mock.calls[0][0];
      expect(movArgs.data.tipo).toBe(MovimientoInventarioTipo.ENTRADA);
      expect(movArgs.data.cantidad).toBe(10);
      expect(movArgs.data.stockResultante).toBe(10);
      expect(result.stockActual).toBe(10);
      expect(result.stockDisponible).toBe(10);
    });

    it('no genera movimiento ENTRADA si stockInicial = 0', async () => {
      prisma.repuesto.findUnique.mockResolvedValue(null);
      prisma.repuesto.create.mockResolvedValue({ id: REPUESTO_ID });
      prisma.repuesto.findUniqueOrThrow.mockResolvedValue({
        id: REPUESTO_ID,
        codigo: 'X',
        nombre: 'X',
        unidad: 'unidad',
        stockMinimo: 0,
        activo: true,
        descripcion: null,
        categoria: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        stock: { stockActual: 0, stockReservado: 0 },
      });

      await service.createRepuesto(TENANT, ADMIN.id, {
        codigo: 'X',
        nombre: 'X',
      });

      expect(prisma.movimientoInventario.create).not.toHaveBeenCalled();
    });

    it('impide código duplicado en el tenant', async () => {
      prisma.repuesto.findUnique.mockResolvedValue({ id: 'otro' });

      await expect(
        service.createRepuesto(TENANT, ADMIN.id, {
          codigo: 'DUP',
          nombre: 'X',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.repuesto.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllRepuestos', () => {
    it('mechanic solo ve activos (no respeta includeInactive)', async () => {
      prisma.repuesto.findMany.mockResolvedValue([]);
      prisma.repuesto.count.mockResolvedValue(0);

      await service.findAllRepuestos(TENANT, MECH(), {
        page: 1,
        limit: 10,
        includeInactive: true,
      });

      const args = prisma.repuesto.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({ tenantId: TENANT, activo: true });
    });

    it('admin con includeInactive=true ve todos', async () => {
      prisma.repuesto.findMany.mockResolvedValue([]);
      prisma.repuesto.count.mockResolvedValue(0);

      await service.findAllRepuestos(TENANT, ADMIN, {
        page: 1,
        limit: 10,
        includeInactive: true,
      });

      const args = prisma.repuesto.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ tenantId: TENANT });
    });

    it('filtra bajoStock via SQL (raw) y pagina sobre el resultado', async () => {
      // El raw query devuelve solo los ids que cumplen la condicion.
      prisma.$queryRaw.mockResolvedValueOnce([{ id: 'b' }]);
      prisma.repuesto.findMany.mockResolvedValue([
        {
          id: 'b',
          codigo: 'B',
          nombre: 'B',
          unidad: 'u',
          stockMinimo: 5,
          activo: true,
          descripcion: null,
          categoria: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          stock: { stockActual: 5, stockReservado: 2 }, // dispon=3 <= min=5 → bajo
        },
      ]);
      prisma.repuesto.count.mockResolvedValue(1);

      const result = await service.findAllRepuestos(TENANT, ADMIN, {
        page: 1,
        limit: 10,
        bajoStock: true,
      });

      // findMany se llama con where.id.in restringido a los ids del raw query.
      const findArgs = prisma.repuesto.findMany.mock.calls[0][0];
      expect(findArgs.where.id).toEqual({ in: ['b'] });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('b');
      expect(result.data[0].bajoStock).toBe(true);
      // total proviene del count del where (no de data.length).
      expect(result.meta.total).toBe(1);
    });
  });

  describe('updateRepuesto', () => {
    it('impide código duplicado al renombrar', async () => {
      prisma.repuesto.findFirst.mockResolvedValue({
        id: REPUESTO_ID,
        codigo: 'OLD',
      });
      prisma.repuesto.findUnique.mockResolvedValue({ id: 'otro' });

      await expect(
        service.updateRepuesto(TENANT, REPUESTO_ID, { codigo: 'NEW' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('desactivarRepuesto', () => {
    it('impide desactivar si hay stockReservado > 0', async () => {
      prisma.repuesto.findFirst.mockResolvedValue({
        id: REPUESTO_ID,
        stock: { stockReservado: 3, stockActual: 5 },
      });

      await expect(
        service.desactivarRepuesto(TENANT, REPUESTO_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('desactiva (activo=false) cuando no hay reservado', async () => {
      prisma.repuesto.findFirst.mockResolvedValue({
        id: REPUESTO_ID,
        stock: { stockReservado: 0, stockActual: 5 },
      });
      prisma.repuesto.update.mockResolvedValue({
        id: REPUESTO_ID,
        codigo: 'X',
        nombre: 'X',
        unidad: 'u',
        stockMinimo: 0,
        activo: false,
        descripcion: null,
        categoria: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        stock: { stockActual: 5, stockReservado: 0 },
      });

      const result = await service.desactivarRepuesto(TENANT, REPUESTO_ID);
      expect(result.activo).toBe(false);
    });
  });

  // ============================================================
  // Stock — entrada y ajuste
  // ============================================================

  describe('entradaStock', () => {
    it('aumenta stockActual y genera movimiento ENTRADA', async () => {
      prisma.repuesto.findFirst.mockResolvedValue({
        id: REPUESTO_ID,
        activo: true,
        stock: { id: 'st-1', stockActual: 5, stockReservado: 0 },
      });
      prisma.inventarioStock.update.mockResolvedValue({});
      prisma.movimientoInventario.create.mockResolvedValue({});
      prisma.repuesto.findUniqueOrThrow.mockResolvedValue({
        id: REPUESTO_ID,
        codigo: 'X',
        nombre: 'X',
        unidad: 'u',
        stockMinimo: 0,
        activo: true,
        descripcion: null,
        categoria: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        stock: { stockActual: 8, stockReservado: 0 },
      });

      await service.entradaStock(TENANT, ADMIN.id, REPUESTO_ID, {
        cantidad: 3,
        observacion: 'Compra',
      });

      const stockArgs = prisma.inventarioStock.update.mock.calls[0][0];
      expect(stockArgs.data.stockActual).toBe(8);
      const movArgs = prisma.movimientoInventario.create.mock.calls[0][0];
      expect(movArgs.data.tipo).toBe(MovimientoInventarioTipo.ENTRADA);
      expect(movArgs.data.cantidad).toBe(3);
      expect(movArgs.data.stockResultante).toBe(8);
    });

    it('falla si el repuesto está inactivo', async () => {
      prisma.repuesto.findFirst.mockResolvedValue({
        id: REPUESTO_ID,
        activo: false,
        stock: { id: 'st', stockActual: 0, stockReservado: 0 },
      });

      await expect(
        service.entradaStock(TENANT, ADMIN.id, REPUESTO_ID, { cantidad: 1 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('ajusteStock', () => {
    it('genera movimiento AJUSTE con delta = nuevoStockActual - stockActual', async () => {
      prisma.repuesto.findFirst.mockResolvedValue({
        id: REPUESTO_ID,
        activo: true,
        stock: { id: 'st-1', stockActual: 10, stockReservado: 2 },
      });
      prisma.inventarioStock.update.mockResolvedValue({});
      prisma.movimientoInventario.create.mockResolvedValue({});
      prisma.repuesto.findUniqueOrThrow.mockResolvedValue({
        id: REPUESTO_ID,
        codigo: 'X',
        nombre: 'X',
        unidad: 'u',
        stockMinimo: 0,
        activo: true,
        descripcion: null,
        categoria: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        stock: { stockActual: 7, stockReservado: 2 },
      });

      await service.ajusteStock(TENANT, ADMIN.id, REPUESTO_ID, {
        nuevoStockActual: 7,
        observacion: 'Conteo físico',
      });

      const movArgs = prisma.movimientoInventario.create.mock.calls[0][0];
      expect(movArgs.data.tipo).toBe(MovimientoInventarioTipo.AJUSTE);
      expect(movArgs.data.cantidad).toBe(-3);
      expect(movArgs.data.stockResultante).toBe(7);
      expect(movArgs.data.observacion).toBe('Conteo físico');
    });

    it('impide ajustar a un valor menor que stockReservado', async () => {
      prisma.repuesto.findFirst.mockResolvedValue({
        id: REPUESTO_ID,
        activo: true,
        stock: { id: 'st-1', stockActual: 10, stockReservado: 5 },
      });

      await expect(
        service.ajusteStock(TENANT, ADMIN.id, REPUESTO_ID, {
          nuevoStockActual: 3,
          observacion: 'x',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.inventarioStock.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // Reservas
  // ============================================================

  function mockTicketForReserva(
    estado: TicketEstado,
    mecanicoId: string | null = null,
  ) {
    prisma.ticket.findFirst.mockResolvedValue({
      id: TICKET_ID,
      estado,
      mecanicoId,
      codigo: 'TKT-1',
    });
  }

  function mockRepuestos(
    items: Array<{
      id: string;
      activo?: boolean;
      actual: number;
      reservado: number;
    }>,
  ) {
    prisma.repuesto.findMany.mockResolvedValue(
      items.map((it) => ({
        id: it.id,
        codigo: `C-${it.id}`,
        activo: it.activo ?? true,
        stock: {
          id: `st-${it.id}`,
          stockActual: it.actual,
          stockReservado: it.reservado,
        },
      })),
    );
  }

  describe('createReserva', () => {
    it('crea reserva RESERVADA, aumenta stockReservado y emite movimiento RESERVA por item', async () => {
      mockTicketForReserva(TicketEstado.ASIGNADO, 'user-mech');
      mockRepuestos([
        { id: 'r1', actual: 10, reservado: 2 },
        { id: 'r2', actual: 5, reservado: 0 },
      ]);
      prisma.reservaRepuesto.create.mockResolvedValue({
        id: 'res-1',
        items: [
          { id: 'i1', reservaId: 'res-1', repuestoId: 'r1', cantidad: 3 },
          { id: 'i2', reservaId: 'res-1', repuestoId: 'r2', cantidad: 1 },
        ],
      });
      prisma.inventarioStock.update.mockResolvedValue({});
      prisma.movimientoInventario.create.mockResolvedValue({});

      const result = await service.createReserva(
        TENANT,
        MECH('user-mech'),
        TICKET_ID,
        {
          items: [
            { repuestoId: 'r1', cantidad: 3 },
            { repuestoId: 'r2', cantidad: 1 },
          ],
        },
      );

      expect(result.id).toBe('res-1');
      const createArgs = prisma.reservaRepuesto.create.mock.calls[0][0];
      expect(createArgs.data.estado).toBe(ReservaRepuestoEstado.RESERVADA);
      expect(createArgs.data.ticketId).toBe(TICKET_ID);

      // Cada item produce un update de stockReservado y un movimiento RESERVA.
      expect(prisma.inventarioStock.update).toHaveBeenCalledTimes(2);
      expect(prisma.movimientoInventario.create).toHaveBeenCalledTimes(2);
      const mov0 = prisma.movimientoInventario.create.mock.calls[0][0];
      expect(mov0.data.tipo).toBe(MovimientoInventarioTipo.RESERVA);
    });

    it('agrega cantidades cuando vienen items duplicados por repuesto', async () => {
      mockTicketForReserva(TicketEstado.ASIGNADO, 'user-mech');
      mockRepuestos([{ id: 'r1', actual: 10, reservado: 0 }]);
      prisma.reservaRepuesto.create.mockResolvedValue({
        id: 'res-1',
        items: [],
      });

      await service.createReserva(TENANT, MECH('user-mech'), TICKET_ID, {
        items: [
          { repuestoId: 'r1', cantidad: 2 },
          { repuestoId: 'r1', cantidad: 3 },
        ],
      });

      const createArgs = prisma.reservaRepuesto.create.mock.calls[0][0];
      expect(createArgs.data.items.create).toEqual([
        { repuestoId: 'r1', cantidad: 5 },
      ]);
    });

    it('impide reservar si stock disponible < cantidad solicitada', async () => {
      mockTicketForReserva(TicketEstado.ASIGNADO, 'user-mech');
      mockRepuestos([{ id: 'r1', actual: 5, reservado: 3 }]); // disponible=2

      await expect(
        service.createReserva(TENANT, MECH('user-mech'), TICKET_ID, {
          items: [{ repuestoId: 'r1', cantidad: 5 }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.reservaRepuesto.create).not.toHaveBeenCalled();
    });

    it.each([
      TicketEstado.EJECUTADO,
      TicketEstado.CERRADO,
      TicketEstado.CANCELADO,
    ])('impide reservar para ticket en estado %s', async (estado) => {
      mockTicketForReserva(estado, 'user-mech');

      await expect(
        service.createReserva(TENANT, ADMIN, TICKET_ID, {
          items: [{ repuestoId: 'r1', cantidad: 1 }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('mechanic no puede reservar en ticket ajeno (Forbidden)', async () => {
      mockTicketForReserva(TicketEstado.ASIGNADO, 'otro-mec');

      await expect(
        service.createReserva(TENANT, MECH('user-mech'), TICKET_ID, {
          items: [{ repuestoId: 'r1', cantidad: 1 }],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('impide reservar si el repuesto está inactivo', async () => {
      mockTicketForReserva(TicketEstado.ASIGNADO, 'user-mech');
      mockRepuestos([{ id: 'r1', activo: false, actual: 10, reservado: 0 }]);

      await expect(
        service.createReserva(TENANT, MECH('user-mech'), TICKET_ID, {
          items: [{ repuestoId: 'r1', cantidad: 1 }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('liberarReserva', () => {
    it('libera RESERVADA, disminuye stockReservado y emite movimiento LIBERACION', async () => {
      prisma.reservaRepuesto.findFirst.mockResolvedValue({
        id: 'res-1',
        tenantId: TENANT,
        ticketId: TICKET_ID,
        estado: ReservaRepuestoEstado.RESERVADA,
        items: [{ repuestoId: 'r1', cantidad: 3 }],
        ticket: { id: TICKET_ID, mecanicoId: 'user-mech' },
      });
      prisma.inventarioStock.findUnique.mockResolvedValue({
        id: 'st-r1',
        stockActual: 10,
        stockReservado: 3,
      });
      prisma.inventarioStock.update.mockResolvedValue({});
      prisma.movimientoInventario.create.mockResolvedValue({});
      prisma.reservaRepuesto.update.mockResolvedValue({
        id: 'res-1',
        estado: ReservaRepuestoEstado.LIBERADA,
      });

      const result = await service.liberarReserva(TENANT, ADMIN, 'res-1', {});

      const stockArgs = prisma.inventarioStock.update.mock.calls[0][0];
      expect(stockArgs.data.stockReservado).toBe(0);
      const movArgs = prisma.movimientoInventario.create.mock.calls[0][0];
      expect(movArgs.data.tipo).toBe(MovimientoInventarioTipo.LIBERACION);
      expect(movArgs.data.cantidad).toBe(-3);
      // stockActual NO se modifica al liberar.
      expect(stockArgs.data.stockActual).toBeUndefined();
      expect(result.estado).toBe(ReservaRepuestoEstado.LIBERADA);
    });

    it.each([
      ReservaRepuestoEstado.CONSUMIDA,
      ReservaRepuestoEstado.LIBERADA,
      ReservaRepuestoEstado.CANCELADA,
    ])('no permite liberar reserva en estado %s', async (estado) => {
      prisma.reservaRepuesto.findFirst.mockResolvedValue({
        id: 'res-1',
        tenantId: TENANT,
        estado,
        items: [],
        ticket: { id: TICKET_ID, mecanicoId: null },
      });

      await expect(
        service.liberarReserva(TENANT, ADMIN, 'res-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('mechanic no puede liberar reserva de ticket ajeno', async () => {
      prisma.reservaRepuesto.findFirst.mockResolvedValue({
        id: 'res-1',
        tenantId: TENANT,
        estado: ReservaRepuestoEstado.RESERVADA,
        items: [],
        ticket: { id: TICKET_ID, mecanicoId: 'otro' },
      });

      await expect(
        service.liberarReserva(TENANT, MECH('user-mech'), 'res-1', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('consumirReserva', () => {
    it('consume RESERVADA, disminuye stockActual y stockReservado, emite CONSUMO', async () => {
      prisma.reservaRepuesto.findFirst.mockResolvedValue({
        id: 'res-1',
        tenantId: TENANT,
        ticketId: TICKET_ID,
        estado: ReservaRepuestoEstado.RESERVADA,
        items: [{ repuestoId: 'r1', cantidad: 2 }],
        ticket: { id: TICKET_ID, mecanicoId: 'user-mech' },
      });
      prisma.inventarioStock.findUnique.mockResolvedValue({
        id: 'st-r1',
        stockActual: 10,
        stockReservado: 2,
      });
      prisma.inventarioStock.update.mockResolvedValue({});
      prisma.movimientoInventario.create.mockResolvedValue({});
      prisma.reservaRepuesto.update.mockResolvedValue({
        id: 'res-1',
        estado: ReservaRepuestoEstado.CONSUMIDA,
      });

      const result = await service.consumirReserva(TENANT, JEFE, 'res-1', {
        observacion: 'reparación',
      });

      const stockArgs = prisma.inventarioStock.update.mock.calls[0][0];
      expect(stockArgs.data.stockActual).toBe(8);
      expect(stockArgs.data.stockReservado).toBe(0);
      const movArgs = prisma.movimientoInventario.create.mock.calls[0][0];
      expect(movArgs.data.tipo).toBe(MovimientoInventarioTipo.CONSUMO);
      expect(movArgs.data.cantidad).toBe(-2);
      expect(movArgs.data.stockResultante).toBe(8);
      expect(result.estado).toBe(ReservaRepuestoEstado.CONSUMIDA);
    });

    it.each([
      ReservaRepuestoEstado.SOLICITADA,
      ReservaRepuestoEstado.LIBERADA,
      ReservaRepuestoEstado.CONSUMIDA,
      ReservaRepuestoEstado.CANCELADA,
    ])('no permite consumir reserva en estado %s', async (estado) => {
      prisma.reservaRepuesto.findFirst.mockResolvedValue({
        id: 'res-1',
        tenantId: TENANT,
        estado,
        items: [],
        ticket: { id: TICKET_ID, mecanicoId: null },
      });

      await expect(
        service.consumirReserva(TENANT, ADMIN, 'res-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ============================================================
  // Movimientos
  // ============================================================

  describe('findAllMovimientos', () => {
    it('filtra por tenant + tipo + reservaId', async () => {
      prisma.movimientoInventario.findMany.mockResolvedValue([]);
      prisma.movimientoInventario.count.mockResolvedValue(0);

      await service.findAllMovimientos(TENANT, {
        page: 1,
        limit: 10,
        tipo: MovimientoInventarioTipo.RESERVA,
        reservaId: 'res-1',
      });

      const args = prisma.movimientoInventario.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        tenantId: TENANT,
        tipo: MovimientoInventarioTipo.RESERVA,
        reservaId: 'res-1',
      });
    });
  });

  // ============================================================
  // Solicitud + Aprobacion (SOLICITADA → RESERVADA)
  // ============================================================

  describe('createReserva con solicitar=true', () => {
    it('mechanic con solicitar=true crea reserva SOLICITADA sin tocar stockReservado ni emitir movimientos', async () => {
      mockTicketForReserva(TicketEstado.ASIGNADO, 'user-mech');
      mockRepuestos([{ id: 'r1', actual: 10, reservado: 0 }]);
      prisma.reservaRepuesto.create.mockResolvedValue({
        id: 'res-sol',
        estado: ReservaRepuestoEstado.SOLICITADA,
        items: [{ id: 'i1', repuestoId: 'r1', cantidad: 2 }],
      });

      const result = await service.createReserva(
        TENANT,
        MECH('user-mech'),
        TICKET_ID,
        {
          solicitar: true,
          items: [{ repuestoId: 'r1', cantidad: 2 }],
        },
      );

      expect(result.estado).toBe(ReservaRepuestoEstado.SOLICITADA);
      const createArgs = prisma.reservaRepuesto.create.mock.calls[0][0];
      expect(createArgs.data.estado).toBe(ReservaRepuestoEstado.SOLICITADA);
      // SOLICITADA NO toca stockReservado ni emite movimientos.
      expect(prisma.inventarioStock.update).not.toHaveBeenCalled();
      expect(prisma.movimientoInventario.create).not.toHaveBeenCalled();
    });

    it('admin con solicitar=true ignora el flag y crea directamente RESERVADA', async () => {
      mockTicketForReserva(TicketEstado.ASIGNADO, 'user-mech');
      mockRepuestos([{ id: 'r1', actual: 10, reservado: 0 }]);
      prisma.reservaRepuesto.create.mockResolvedValue({
        id: 'res-direct',
        estado: ReservaRepuestoEstado.RESERVADA,
        items: [{ id: 'i1', repuestoId: 'r1', cantidad: 2 }],
      });
      prisma.inventarioStock.update.mockResolvedValue({});
      prisma.movimientoInventario.create.mockResolvedValue({});

      await service.createReserva(TENANT, ADMIN, TICKET_ID, {
        solicitar: true,
        items: [{ repuestoId: 'r1', cantidad: 2 }],
      });

      const createArgs = prisma.reservaRepuesto.create.mock.calls[0][0];
      expect(createArgs.data.estado).toBe(ReservaRepuestoEstado.RESERVADA);
      expect(prisma.inventarioStock.update).toHaveBeenCalledTimes(1);
      expect(prisma.movimientoInventario.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('aprobarReserva', () => {
    it('transiciona SOLICITADA → RESERVADA aplicando stockReservado y emitiendo movimiento RESERVA', async () => {
      prisma.reservaRepuesto.findFirst.mockResolvedValue({
        id: 'res-1',
        tenantId: TENANT,
        ticketId: TICKET_ID,
        estado: ReservaRepuestoEstado.SOLICITADA,
        items: [{ repuestoId: 'r1', cantidad: 3 }],
        ticket: { id: TICKET_ID, mecanicoId: 'user-mech' },
      });
      prisma.repuesto.findMany.mockResolvedValue([
        {
          id: 'r1',
          codigo: 'R1',
          activo: true,
          stock: { id: 'st-r1', stockActual: 10, stockReservado: 2 },
        },
      ]);
      prisma.inventarioStock.update.mockResolvedValue({});
      prisma.movimientoInventario.create.mockResolvedValue({});
      prisma.reservaRepuesto.update.mockResolvedValue({
        id: 'res-1',
        estado: ReservaRepuestoEstado.RESERVADA,
        aprobadoPorId: ADMIN.id,
      });

      const result = await service.aprobarReserva(TENANT, ADMIN, 'res-1', {});

      const stockArgs = prisma.inventarioStock.update.mock.calls[0][0];
      expect(stockArgs.data.stockReservado).toBe(5); // 2 + 3
      const movArgs = prisma.movimientoInventario.create.mock.calls[0][0];
      expect(movArgs.data.tipo).toBe(MovimientoInventarioTipo.RESERVA);
      expect(movArgs.data.cantidad).toBe(3);
      const updArgs = prisma.reservaRepuesto.update.mock.calls[0][0];
      expect(updArgs.data.estado).toBe(ReservaRepuestoEstado.RESERVADA);
      expect(updArgs.data.aprobadoPorId).toBe(ADMIN.id);
      expect(result.estado).toBe(ReservaRepuestoEstado.RESERVADA);
    });

    it.each([
      ReservaRepuestoEstado.RESERVADA,
      ReservaRepuestoEstado.CONSUMIDA,
      ReservaRepuestoEstado.LIBERADA,
      ReservaRepuestoEstado.CANCELADA,
    ])('rechaza aprobar reserva en estado %s', async (estado) => {
      prisma.reservaRepuesto.findFirst.mockResolvedValue({
        id: 'res-1',
        tenantId: TENANT,
        estado,
        items: [],
        ticket: { id: TICKET_ID, mecanicoId: null },
      });

      await expect(
        service.aprobarReserva(TENANT, ADMIN, 'res-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza aprobar si el stock disponible ya no cubre la cantidad solicitada', async () => {
      prisma.reservaRepuesto.findFirst.mockResolvedValue({
        id: 'res-1',
        tenantId: TENANT,
        ticketId: TICKET_ID,
        estado: ReservaRepuestoEstado.SOLICITADA,
        items: [{ repuestoId: 'r1', cantidad: 5 }],
        ticket: { id: TICKET_ID, mecanicoId: null },
      });
      prisma.repuesto.findMany.mockResolvedValue([
        {
          id: 'r1',
          codigo: 'R1',
          activo: true,
          stock: { id: 'st-r1', stockActual: 5, stockReservado: 3 }, // dispon=2
        },
      ]);

      await expect(
        service.aprobarReserva(TENANT, ADMIN, 'res-1', {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.reservaRepuesto.update).not.toHaveBeenCalled();
    });
  });

  describe('findReservasPendientes', () => {
    it('filtra solo reservas en estado SOLICITADA del tenant', async () => {
      prisma.reservaRepuesto.findMany.mockResolvedValue([]);

      await service.findReservasPendientes(TENANT);

      const args = prisma.reservaRepuesto.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        tenantId: TENANT,
        estado: ReservaRepuestoEstado.SOLICITADA,
      });
    });
  });

  // ============================================================
  // Marca en repuestos (Fase 2)
  // ============================================================

  describe('repuestos con marca', () => {
    const MARCA_OK = {
      id: 'marca-1',
      nombre: 'Bosch',
      tipo: 'REPUESTO',
      activo: true,
    };

    function mockCreateRepuestoOk() {
      prisma.repuesto.findUnique.mockResolvedValue(null);
      prisma.repuesto.create.mockResolvedValue({ id: REPUESTO_ID });
      prisma.inventarioStock.create.mockResolvedValue({});
      prisma.repuesto.findUniqueOrThrow.mockResolvedValue({
        id: REPUESTO_ID,
        codigo: 'FILTRO-001',
        nombre: 'Filtro',
        unidad: 'unidad',
        stockMinimo: 0,
        activo: true,
        descripcion: null,
        categoria: null,
        marcaId: MARCA_OK.id,
        marca: MARCA_OK,
        codigoFabricante: 'BX-99',
        ubicacionBodega: null,
        proveedor: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        stock: { stockActual: 0, stockReservado: 0 },
      });
    }

    it('createRepuesto valida la marca del tenant y persiste los campos nuevos', async () => {
      prisma.marca.findFirst.mockResolvedValue(MARCA_OK);
      mockCreateRepuestoOk();

      const result = await service.createRepuesto(TENANT, ADMIN.id, {
        codigo: 'FILTRO-001',
        nombre: 'Filtro',
        marcaId: MARCA_OK.id,
        codigoFabricante: 'BX-99',
      });

      const marcaArgs = prisma.marca.findFirst.mock.calls[0][0];
      expect(marcaArgs.where).toMatchObject({
        id: MARCA_OK.id,
        tenantId: TENANT,
      });
      const createArgs = prisma.repuesto.create.mock.calls[0][0];
      expect(createArgs.data.marcaId).toBe(MARCA_OK.id);
      expect(createArgs.data.codigoFabricante).toBe('BX-99');
      expect(result.marca).toEqual({ id: MARCA_OK.id, nombre: 'Bosch' });
      expect(result.codigoFabricante).toBe('BX-99');
    });

    it('createRepuesto rechaza marca inexistente o de otro tenant (404)', async () => {
      prisma.marca.findFirst.mockResolvedValue(null);

      await expect(
        service.createRepuesto(TENANT, ADMIN.id, {
          codigo: 'FILTRO-001',
          nombre: 'Filtro',
          marcaId: 'marca-ajena',
        }),
      ).rejects.toMatchObject({ status: 404 });
      expect(prisma.repuesto.create).not.toHaveBeenCalled();
    });

    it('createRepuesto rechaza marca inactiva (409)', async () => {
      prisma.marca.findFirst.mockResolvedValue({
        ...MARCA_OK,
        activo: false,
      });

      await expect(
        service.createRepuesto(TENANT, ADMIN.id, {
          codigo: 'FILTRO-001',
          nombre: 'Filtro',
          marcaId: MARCA_OK.id,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('createRepuesto rechaza marca de ámbito EQUIPO (409)', async () => {
      prisma.marca.findFirst.mockResolvedValue({
        ...MARCA_OK,
        tipo: 'EQUIPO',
      });

      await expect(
        service.createRepuesto(TENANT, ADMIN.id, {
          codigo: 'FILTRO-001',
          nombre: 'Filtro',
          marcaId: MARCA_OK.id,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('updateRepuesto permite limpiar la marca con null sin validarla', async () => {
      prisma.repuesto.findFirst.mockResolvedValue({
        id: REPUESTO_ID,
        codigo: 'FILTRO-001',
      });
      prisma.repuesto.update.mockResolvedValue({
        id: REPUESTO_ID,
        codigo: 'FILTRO-001',
        nombre: 'Filtro',
        unidad: 'unidad',
        stockMinimo: 0,
        activo: true,
        marcaId: null,
        marca: null,
        stock: { stockActual: 0, stockReservado: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updateRepuesto(TENANT, REPUESTO_ID, { marcaId: null });

      expect(prisma.marca.findFirst).not.toHaveBeenCalled();
      const args = prisma.repuesto.update.mock.calls[0][0];
      expect(args.data.marcaId).toBeNull();
    });

    it('findAllRepuestos filtra por marcaId', async () => {
      prisma.repuesto.findMany.mockResolvedValue([]);
      prisma.repuesto.count.mockResolvedValue(0);

      await service.findAllRepuestos(TENANT, ADMIN, {
        page: 1,
        limit: 10,
        marcaId: MARCA_OK.id,
      });

      const args = prisma.repuesto.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({
        tenantId: TENANT,
        marcaId: MARCA_OK.id,
      });
    });
  });
});
