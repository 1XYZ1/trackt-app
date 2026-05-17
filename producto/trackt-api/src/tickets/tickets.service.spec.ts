import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  OrdenTrabajoEstado,
  Prioridad,
  TicketEstado,
} from '@prisma/client';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Mock del PrismaService.
 * `$transaction` soporta los dos contratos que usa el service:
 *  - array: `prisma.$transaction([p1, p2])` → ejecuta y devuelve resultados en orden
 *  - callback: `prisma.$transaction(async (tx) => ...)` → invoca con un "tx" mock
 *    que delega en los mismos métodos de prisma.
 *
 * `$queryRaw` se usa para dos casos: advisory lock (dentro de TX) y batch fetch
 * de profiles (fuera de TX). El default mock retorna [] (sin profiles).
 */
function buildPrismaMock() {
  const mock = {
    ordenTrabajo: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    ticket: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn(),
    },
    eventoEstadoTicket: {
      create: jest.fn(),
    },
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
const USER = 'user-admin';
const OT_ID = 'ot-1';
const TICKET_ID = 'tk-1';

function fakeEquipo() {
  return {
    id: 'eq-1',
    codigo: 'EQ-001',
    nombre: 'Camion Minero',
    marca: 'CAT',
    modelo: '793F',
    ubicacion: 'Rajo',
  };
}

function fakeOt(estado: OrdenTrabajoEstado = OrdenTrabajoEstado.EN_PROCESO) {
  return {
    id: OT_ID,
    codigo: 'OT-1',
    estado,
    equipoId: 'eq-1',
    equipo: fakeEquipo(),
  };
}

function fakeTicketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID,
    tenantId: TENANT,
    otId: OT_ID,
    codigo: 'TKT-2026-0001',
    titulo: 'Falla motor',
    descripcion: 'Detalle',
    estado: TicketEstado.PENDIENTE,
    prioridad: Prioridad.MEDIA,
    mecanicoId: null,
    jefeId: USER,
    fechaAsignacion: null,
    fechaInicioEjecucion: null,
    fechaFinEjecucion: null,
    fechaValidacion: null,
    fechaCierre: null,
    metadata: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    ot: fakeOt(),
    eventos: [
      {
        id: 'evt-1',
        ticketId: TICKET_ID,
        estadoAnterior: null,
        estadoNuevo: TicketEstado.PENDIENTE,
        usuarioId: USER,
        observacion: 'Ticket creado',
        metadata: null,
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
    ],
    ...overrides,
  };
}

describe('TicketsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: TicketsService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new TicketsService(prisma as unknown as PrismaService);
  });

  // ---------- createFromOrden ----------

  describe('createFromOrden', () => {
    function mockCreateChain({
      otEstado = OrdenTrabajoEstado.PENDIENTE,
      lastCodigo = null as string | null,
      updateManyCount = 1,
    } = {}) {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: otEstado,
      });
      prisma.ticket.findFirst.mockResolvedValueOnce(
        lastCodigo ? { codigo: lastCodigo } : null,
      );
      prisma.ticket.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: TICKET_ID, ...data }),
      );
      prisma.eventoEstadoTicket.create.mockResolvedValue({ id: 'evt-1' });
      prisma.ordenTrabajo.updateMany.mockResolvedValue({
        count: updateManyCount,
      });
      prisma.ticket.findUniqueOrThrow.mockImplementation(({ where }) =>
        Promise.resolve(fakeTicketRow({ id: where.id })),
      );
    }

    it('crea ticket en estado PENDIENTE con tenantId, otId y jefeId', async () => {
      mockCreateChain();

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 'Falla motor',
        descripcion: 'Detalle',
        prioridad: Prioridad.ALTA,
      });

      const createArgs = prisma.ticket.create.mock.calls[0][0];
      expect(createArgs.data.tenantId).toBe(TENANT);
      expect(createArgs.data.otId).toBe(OT_ID);
      expect(createArgs.data.jefeId).toBe(USER);
      expect(createArgs.data.estado).toBe(TicketEstado.PENDIENTE);
      expect(createArgs.data.prioridad).toBe(Prioridad.ALTA);
      expect(createArgs.data.titulo).toBe('Falla motor');
    });

    it('aplica prioridad MEDIA por defecto cuando no viene en el DTO', async () => {
      mockCreateChain();

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      const createArgs = prisma.ticket.create.mock.calls[0][0];
      expect(createArgs.data.prioridad).toBe(Prioridad.MEDIA);
    });

    it('genera código TKT-YYYY-0001 cuando no hay tickets previos del año', async () => {
      mockCreateChain({ lastCodigo: null });

      const year = new Date().getUTCFullYear();
      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      const createArgs = prisma.ticket.create.mock.calls[0][0];
      expect(createArgs.data.codigo).toBe(`TKT-${year}-0001`);
    });

    it('incrementa la secuencia desde el último código del año', async () => {
      const year = new Date().getUTCFullYear();
      mockCreateChain({ lastCodigo: `TKT-${year}-0041` });

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      const createArgs = prisma.ticket.create.mock.calls[0][0];
      expect(createArgs.data.codigo).toBe(`TKT-${year}-0042`);
    });

    it('crea evento inicial con estadoAnterior=null y estadoNuevo=PENDIENTE', async () => {
      mockCreateChain();

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      const evtArgs = prisma.eventoEstadoTicket.create.mock.calls[0][0];
      expect(evtArgs.data.estadoAnterior).toBeNull();
      expect(evtArgs.data.estadoNuevo).toBe(TicketEstado.PENDIENTE);
      expect(evtArgs.data.usuarioId).toBe(USER);
      expect(evtArgs.data.ticketId).toBe(TICKET_ID);
      expect(evtArgs.data.observacion).toBe('Ticket creado');
    });

    it('si la OT está PENDIENTE, la transiciona a EN_PROCESO con updateMany filtrando por id/tenant/estado', async () => {
      mockCreateChain({ otEstado: OrdenTrabajoEstado.PENDIENTE });

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      expect(prisma.ordenTrabajo.updateMany).toHaveBeenCalledTimes(1);
      const args = prisma.ordenTrabajo.updateMany.mock.calls[0][0];
      expect(args.where).toEqual({
        id: OT_ID,
        tenantId: TENANT,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });
      expect(args.data).toEqual({ estado: OrdenTrabajoEstado.EN_PROCESO });
    });

    it('no actualiza la OT si ya está EN_PROCESO', async () => {
      mockCreateChain({ otEstado: OrdenTrabajoEstado.EN_PROCESO });

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      expect(prisma.ordenTrabajo.updateMany).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si updateMany retorna count=0 (OT mutó concurrentemente entre re-read y update)', async () => {
      mockCreateChain({
        otEstado: OrdenTrabajoEstado.PENDIENTE,
        updateManyCount: 0,
      });

      await expect(
        service.createFromOrden(TENANT, USER, OT_ID, {
          titulo: 't',
          descripcion: 'd',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      // findUniqueOrThrow no se ejecutó porque el throw aborta la TX
      expect(prisma.ticket.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('toma advisory lock por tenant/año dentro de la transacción', async () => {
      mockCreateChain();

      await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 't',
        descripcion: 'd',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$queryRaw).toHaveBeenCalled();
      const arg = prisma.$transaction.mock.calls[0][0];
      expect(typeof arg).toBe('function');
    });

    it('atomicidad: si falla updateMany de la OT, no se retorna ticket (rollback) y la creación ocurre dentro del callback transaccional', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });
      prisma.ticket.findFirst.mockResolvedValueOnce(null);
      prisma.ticket.create.mockResolvedValue({ id: TICKET_ID });
      prisma.eventoEstadoTicket.create.mockResolvedValue({ id: 'evt-1' });
      const dbErr = new Error('DB write conflict');
      prisma.ordenTrabajo.updateMany.mockRejectedValueOnce(dbErr);

      prisma.$transaction.mockImplementationOnce(async (cb: unknown) => {
        if (typeof cb === 'function') {
          return (cb as (tx: typeof prisma) => Promise<unknown>)(prisma);
        }
        return undefined;
      });

      await expect(
        service.createFromOrden(TENANT, USER, OT_ID, {
          titulo: 't',
          descripcion: 'd',
        }),
      ).rejects.toBe(dbErr);

      expect(prisma.ticket.create).toHaveBeenCalled();
      expect(prisma.eventoEstadoTicket.create).toHaveBeenCalled();
      expect(prisma.ticket.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('falla con NotFoundException si la OT no existe en el tenant', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createFromOrden(TENANT, USER, 'no-existe', {
          titulo: 't',
          descripcion: 'd',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.ticket.create).not.toHaveBeenCalled();
    });

    it.each([OrdenTrabajoEstado.CERRADA, OrdenTrabajoEstado.CANCELADA])(
      'falla con ConflictException si la OT está %s',
      async (estado) => {
        prisma.ordenTrabajo.findFirst.mockResolvedValueOnce({
          id: OT_ID,
          estado,
        });

        await expect(
          service.createFromOrden(TENANT, USER, OT_ID, {
            titulo: 't',
            descripcion: 'd',
          }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.ticket.create).not.toHaveBeenCalled();
      },
    );

    it('cierra ventana de carrera: si la OT pasa a CANCELADA entre las dos lecturas, lanza ConflictException dentro de la TX y no crea ticket', async () => {
      prisma.ordenTrabajo.findFirst
        .mockResolvedValueOnce({
          id: OT_ID,
          estado: OrdenTrabajoEstado.PENDIENTE,
        })
        .mockResolvedValueOnce({
          id: OT_ID,
          estado: OrdenTrabajoEstado.CANCELADA,
        });

      await expect(
        service.createFromOrden(TENANT, USER, OT_ID, {
          titulo: 't',
          descripcion: 'd',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.ticket.create).not.toHaveBeenCalled();
      expect(prisma.eventoEstadoTicket.create).not.toHaveBeenCalled();
      expect(prisma.ordenTrabajo.updateMany).not.toHaveBeenCalled();
    });

    it('mapea la respuesta al contrato del frontend (ordenId, equipo, mecanico, timeline)', async () => {
      mockCreateChain();
      prisma.$queryRaw.mockImplementation(
        async (strings: TemplateStringsArray) => {
          const sql = strings.join('');
          if (sql.includes('pg_advisory_xact_lock')) return [{}];
          return [{ id: USER, full_name: 'Andrés Admin' }];
        },
      );

      const result = await service.createFromOrden(TENANT, USER, OT_ID, {
        titulo: 'Falla motor',
        descripcion: 'Detalle',
      });

      expect(result).toMatchObject({
        id: TICKET_ID,
        codigo: 'TKT-2026-0001',
        ordenId: OT_ID,
        ordenCodigo: 'OT-1',
        equipo: expect.objectContaining({ id: 'eq-1', codigo: 'EQ-001' }),
        equipoNombre: 'EQ-001 - Camion Minero',
        createdAt: '2026-01-01T10:00:00.000Z',
      });
      expect(result.timeline).toHaveLength(1);
      expect(result.timeline?.[0]).toMatchObject({
        id: 'evt-1',
        estadoNuevo: TicketEstado.PENDIENTE,
        usuario: { id: USER, nombre: 'Andrés Admin' },
        timestamp: '2026-01-01T10:00:00.000Z',
      });
    });
  });

  // ---------- findAll ----------

  describe('findAll', () => {
    it('aplica filtros estado, mecanicoId y otId, y siempre filtra por tenant', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll(TENANT, {
        estado: TicketEstado.PENDIENTE,
        mecanicoId: 'mec-1',
        otId: OT_ID,
        page: 1,
        limit: 10,
      });

      const findArgs = prisma.ticket.findMany.mock.calls[0][0];
      expect(findArgs.where).toEqual({
        tenantId: TENANT,
        estado: TicketEstado.PENDIENTE,
        mecanicoId: 'mec-1',
        otId: OT_ID,
      });
      expect(findArgs.orderBy).toEqual({ createdAt: 'desc' });
      expect(findArgs.include).toMatchObject({ ot: expect.any(Object) });
    });

    it('omite filtros vacíos pero conserva el tenant', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll(TENANT, { page: 1, limit: 5 });

      const findArgs = prisma.ticket.findMany.mock.calls[0][0];
      expect(findArgs.where).toEqual({ tenantId: TENANT });
      expect(findArgs.take).toBe(5);
      expect(findArgs.skip).toBe(0);
    });

    it('retorna estructura paginada con meta calculado y datos mapeados', async () => {
      const rows = [
        fakeTicketRow({ id: 't1', codigo: 'TKT-1', mecanicoId: 'mec-1' }),
        fakeTicketRow({ id: 't2', codigo: 'TKT-2', mecanicoId: null }),
      ];
      prisma.ticket.findMany.mockResolvedValue(rows);
      prisma.ticket.count.mockResolvedValue(12);
      prisma.$queryRaw.mockResolvedValue([
        { id: 'mec-1', full_name: 'Mecanico 1' },
      ]);

      const result = await service.findAll(TENANT, { page: 2, limit: 5 });

      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        total: 12,
        totalPages: 3,
      });
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        id: 't1',
        codigo: 'TKT-1',
        ordenId: OT_ID,
        equipoNombre: 'EQ-001 - Camion Minero',
        mecanico: { id: 'mec-1', nombre: 'Mecanico 1' },
      });
      expect(result.data[1].mecanico).toBeNull();
      // findAll no incluye timeline en list items
      expect(result.data[0].timeline).toBeUndefined();

      const findArgs = prisma.ticket.findMany.mock.calls[0][0];
      expect(findArgs.skip).toBe(5);
      expect(findArgs.take).toBe(5);
    });
  });

  // ---------- findOne ----------

  describe('findOne', () => {
    it('busca por id + tenant e incluye OT padre + equipo + eventos asc, y mapea al contrato del frontend', async () => {
      const row = fakeTicketRow();
      prisma.ticket.findFirst.mockResolvedValue(row);
      prisma.$queryRaw.mockResolvedValue([
        { id: USER, full_name: 'Andrés Admin' },
      ]);

      const result = await service.findOne(TENANT, TICKET_ID);

      const findArgs = prisma.ticket.findFirst.mock.calls[0][0];
      expect(findArgs.where).toEqual({ id: TICKET_ID, tenantId: TENANT });
      expect(findArgs.include).toMatchObject({
        ot: expect.any(Object),
        eventos: { orderBy: { createdAt: 'asc' } },
      });
      expect(result).toMatchObject({
        id: TICKET_ID,
        ordenId: OT_ID,
        ordenCodigo: 'OT-1',
        equipo: expect.objectContaining({ codigo: 'EQ-001' }),
      });
      expect(result.timeline).toHaveLength(1);
      expect(result.timeline?.[0].usuario).toEqual({
        id: USER,
        nombre: 'Andrés Admin',
      });
    });

    it('retorna usuario solo con id si profiles no devuelve fila', async () => {
      const row = fakeTicketRow({ mecanicoId: 'mec-huerfano' });
      prisma.ticket.findFirst.mockResolvedValue(row);
      prisma.$queryRaw.mockResolvedValue([]); // sin profiles

      const result = await service.findOne(TENANT, TICKET_ID);

      expect(result.mecanico).toEqual({ id: 'mec-huerfano' });
    });

    it('falla con NotFoundException si no existe', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT, TICKET_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
