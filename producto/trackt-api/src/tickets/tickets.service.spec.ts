import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  OrdenTrabajoEstado,
  Prioridad,
  TicketEstado,
} from '@prisma/client';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdenesService } from '../ordenes/ordenes.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

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
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    eventoEstadoTicket: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(0),
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

  let ordenesService: { onTicketEstadoCambiado: jest.Mock };
  let notificaciones: { emit: jest.Mock };

  beforeEach(() => {
    prisma = buildPrismaMock();
    ordenesService = { onTicketEstadoCambiado: jest.fn() };
    notificaciones = { emit: jest.fn().mockResolvedValue(undefined) };
    service = new TicketsService(
      prisma as unknown as PrismaService,
      ordenesService as unknown as OrdenesService,
      notificaciones as unknown as NotificacionesService,
    );
  });

  // ---------- createFromOrden ----------

  describe('createFromOrden', () => {
    function mockCreateChain({
      otEstado = OrdenTrabajoEstado.PENDIENTE as OrdenTrabajoEstado,
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
      expect(prisma.$executeRaw).toHaveBeenCalled();
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
      prisma.$queryRaw.mockResolvedValue([
        { id: USER, full_name: 'Andrés Admin' },
      ]);

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

  function userAdmin(overrides: Partial<{ id: string }> = {}) {
    return {
      id: overrides.id ?? USER,
      role: 'admin' as const,
      tenantId: TENANT,
    };
  }

  function userJefe() {
    return {
      id: 'user-jefe',
      role: 'jefe_taller' as const,
      tenantId: TENANT,
    };
  }

  function userMechanic(id = 'mec-1') {
    return {
      id,
      role: 'mechanic' as const,
      tenantId: TENANT,
    };
  }

  describe('findAll', () => {
    it('aplica filtros estado, mecanicoId y otId, y siempre filtra por tenant (admin)', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll(TENANT, userAdmin(), {
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

    it('jefe_taller ve todos los tickets del tenant (sin scoping forzado)', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll(TENANT, userJefe(), { page: 1, limit: 10 });

      const findArgs = prisma.ticket.findMany.mock.calls[0][0];
      expect(findArgs.where).toEqual({ tenantId: TENANT });
    });

    it('mechanic queda forzado a sus propios tickets (ignora mecanicoId del query)', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll(TENANT, userMechanic('mec-1'), {
        mecanicoId: 'otro-mecanico',
        page: 1,
        limit: 10,
      });

      const findArgs = prisma.ticket.findMany.mock.calls[0][0];
      expect(findArgs.where).toEqual({ tenantId: TENANT, mecanicoId: 'mec-1' });
    });

    it('omite filtros vacíos pero conserva el tenant', async () => {
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);

      await service.findAll(TENANT, userAdmin(), { page: 1, limit: 5 });

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

      const result = await service.findAll(TENANT, userAdmin(), { page: 2, limit: 5 });

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

      const result = await service.findOne(TENANT, userAdmin(), TICKET_ID);

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

      const result = await service.findOne(TENANT, userAdmin(), TICKET_ID);

      expect(result.mecanico).toEqual({ id: 'mec-huerfano' });
    });

    it('mechanic recibe 404 si el ticket no está asignado a él (no filtra existencia)', async () => {
      const row = fakeTicketRow({ mecanicoId: 'otro-mec' });
      prisma.ticket.findFirst.mockResolvedValue(row);

      await expect(
        service.findOne(TENANT, userMechanic('mec-self'), TICKET_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('falla con NotFoundException si no existe', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT, userAdmin(), TICKET_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- Transiciones de estado (TRA-27) ----------

  function mockTicket(
    estado: TicketEstado,
    mecanicoId: string | null = null,
  ) {
    // 1ra llamada: requireTicket() en cada transición.
    prisma.ticket.findFirst.mockResolvedValueOnce({
      id: TICKET_ID,
      codigo: 'TKT-2026-0001',
      titulo: 't',
      estado,
      otId: OT_ID,
      mecanicoId,
      jefeId: USER,
      fechaValidacion: null,
    });
    // 2da llamada: findOne() POST-transacción (asignar/iniciar/finalizar
    // ahora hacen el read fuera de la tx para no exceder timeout).
    const detail = {
      id: TICKET_ID,
      tenantId: TENANT,
      otId: OT_ID,
      codigo: 'TKT-2026-0001',
      titulo: 't',
      descripcion: 'd',
      estado,
      prioridad: Prioridad.MEDIA,
      mecanicoId,
      jefeId: USER,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-01T10:00:00Z'),
      fechaAsignacion: null,
      fechaInicioEjecucion: null,
      fechaFinEjecucion: null,
      fechaValidacion: null,
      fechaCierre: null,
      ot: { id: OT_ID, codigo: 'OT-1', equipo: null },
      eventos: [],
    };
    prisma.ticket.findFirst.mockResolvedValueOnce(detail);
    prisma.ticket.findUniqueOrThrow.mockResolvedValue(detail);
  }

  describe('asignar', () => {
    const MEC = '00000000-0000-0000-0000-000000000099';
    const dto = { mecanicoId: MEC };

    it('happy path: PENDIENTE → ASIGNADO con mecanico válido del tenant', async () => {
      mockTicket(TicketEstado.PENDIENTE);
      prisma.$queryRaw.mockResolvedValueOnce([{ id: MEC }]); // mecanico lookup
      prisma.ticket.update.mockResolvedValue({});
      prisma.eventoEstadoTicket.create.mockResolvedValue({});

      await service.asignar(TENANT, USER, TICKET_ID, dto);

      const updateArgs = prisma.ticket.update.mock.calls[0][0];
      expect(updateArgs.data.estado).toBe(TicketEstado.ASIGNADO);
      expect(updateArgs.data.mecanicoId).toBe(MEC);
      expect(prisma.eventoEstadoTicket.create).toHaveBeenCalled();
    });

    it('falla con Conflict si ticket no está PENDIENTE', async () => {
      mockTicket(TicketEstado.ASIGNADO);

      await expect(
        service.asignar(TENANT, USER, TICKET_ID, dto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('falla con NotFound si mecanico no existe en el tenant', async () => {
      mockTicket(TicketEstado.PENDIENTE);
      prisma.$queryRaw.mockResolvedValueOnce([]); // mecanico no encontrado

      await expect(
        service.asignar(TENANT, USER, TICKET_ID, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('iniciar', () => {
    const MEC = '00000000-0000-0000-0000-000000000099';

    it('happy path: mecanico asignado inicia ejecucion', async () => {
      mockTicket(TicketEstado.ASIGNADO, MEC);
      prisma.ticket.update.mockResolvedValue({});
      prisma.eventoEstadoTicket.create.mockResolvedValue({});

      await service.iniciar(TENANT, MEC, TICKET_ID);

      const updateArgs = prisma.ticket.update.mock.calls[0][0];
      expect(updateArgs.data.estado).toBe(TicketEstado.EN_EJECUCION);
    });

    it('falla con Forbidden si el caller no es el mecanico asignado', async () => {
      mockTicket(TicketEstado.ASIGNADO, MEC);

      await expect(
        service.iniciar(TENANT, 'otro-user', TICKET_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('falla con Conflict si no está ASIGNADO', async () => {
      mockTicket(TicketEstado.PENDIENTE, MEC);

      await expect(
        service.iniciar(TENANT, MEC, TICKET_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('finalizar', () => {
    const MEC = '00000000-0000-0000-0000-000000000099';

    it('happy path: EN_EJECUCION → EJECUTADO', async () => {
      mockTicket(TicketEstado.EN_EJECUCION, MEC);
      prisma.ticket.update.mockResolvedValue({});
      prisma.eventoEstadoTicket.create.mockResolvedValue({});

      await service.finalizar(TENANT, MEC, TICKET_ID, { observacion: 'ok' });

      const updateArgs = prisma.ticket.update.mock.calls[0][0];
      expect(updateArgs.data.estado).toBe(TicketEstado.EJECUTADO);
    });

    it('falla con Forbidden si no es el mecanico asignado', async () => {
      mockTicket(TicketEstado.EN_EJECUCION, MEC);

      await expect(
        service.finalizar(TENANT, 'otro', TICKET_ID, {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('validar', () => {
    it('aprobado → CERRADO + invoca cascada OT', async () => {
      mockTicket(TicketEstado.EJECUTADO, 'mec-1');
      prisma.ticket.update.mockResolvedValue({});
      prisma.eventoEstadoTicket.create.mockResolvedValue({});
      // findOne post-transaction
      prisma.ticket.findFirst.mockResolvedValueOnce({
        id: TICKET_ID,
        tenantId: TENANT,
        otId: OT_ID,
        codigo: 'TKT-2026-0001',
        titulo: 't',
        descripcion: 'd',
        estado: TicketEstado.CERRADO,
        prioridad: Prioridad.MEDIA,
        mecanicoId: 'mec-1',
        jefeId: USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        fechaAsignacion: null,
        fechaInicioEjecucion: null,
        fechaFinEjecucion: null,
        fechaValidacion: null,
        fechaCierre: null,
        ot: { id: OT_ID, codigo: 'OT-1', equipo: null },
        eventos: [],
      });

      await service.validar(TENANT, USER, TICKET_ID, { aprobado: true });

      const updateArgs = prisma.ticket.update.mock.calls[0][0];
      expect(updateArgs.data.estado).toBe(TicketEstado.CERRADO);
      expect(ordenesService.onTicketEstadoCambiado).toHaveBeenCalledWith(
        TENANT,
        OT_ID,
      );
    });

    it('rechazado → vuelve a EN_EJECUCION sin invocar cascada', async () => {
      mockTicket(TicketEstado.EJECUTADO, 'mec-1');
      prisma.ticket.update.mockResolvedValue({});
      prisma.eventoEstadoTicket.create.mockResolvedValue({});
      prisma.ticket.findFirst.mockResolvedValueOnce({
        id: TICKET_ID,
        tenantId: TENANT,
        otId: OT_ID,
        codigo: 'TKT-2026-0001',
        titulo: 't',
        descripcion: 'd',
        estado: TicketEstado.EN_EJECUCION,
        prioridad: Prioridad.MEDIA,
        mecanicoId: 'mec-1',
        jefeId: USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        fechaAsignacion: null,
        fechaInicioEjecucion: null,
        fechaFinEjecucion: null,
        fechaValidacion: null,
        fechaCierre: null,
        ot: { id: OT_ID, codigo: 'OT-1', equipo: null },
        eventos: [],
      });

      await service.validar(TENANT, USER, TICKET_ID, { aprobado: false });

      const updateArgs = prisma.ticket.update.mock.calls[0][0];
      expect(updateArgs.data.estado).toBe(TicketEstado.EN_EJECUCION);
      expect(updateArgs.data.fechaFinEjecucion).toBeNull();
      expect(ordenesService.onTicketEstadoCambiado).not.toHaveBeenCalled();
    });

    it('falla con Conflict si no está EJECUTADO', async () => {
      mockTicket(TicketEstado.EN_EJECUCION, 'mec-1');

      await expect(
        service.validar(TENANT, USER, TICKET_ID, { aprobado: true }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('cerrar', () => {
    it('EJECUTADO → CERRADO + invoca cascada OT', async () => {
      mockTicket(TicketEstado.EJECUTADO, 'mec-1');
      prisma.ticket.update.mockResolvedValue({});
      prisma.eventoEstadoTicket.create.mockResolvedValue({});
      prisma.ticket.findFirst.mockResolvedValueOnce({
        id: TICKET_ID,
        tenantId: TENANT,
        otId: OT_ID,
        codigo: 'TKT-2026-0001',
        titulo: 't',
        descripcion: 'd',
        estado: TicketEstado.CERRADO,
        prioridad: Prioridad.MEDIA,
        mecanicoId: 'mec-1',
        jefeId: USER,
        createdAt: new Date(),
        updatedAt: new Date(),
        fechaAsignacion: null,
        fechaInicioEjecucion: null,
        fechaFinEjecucion: null,
        fechaValidacion: null,
        fechaCierre: null,
        ot: { id: OT_ID, codigo: 'OT-1', equipo: null },
        eventos: [],
      });

      await service.cerrar(TENANT, USER, TICKET_ID, {});

      const updateArgs = prisma.ticket.update.mock.calls[0][0];
      expect(updateArgs.data.estado).toBe(TicketEstado.CERRADO);
      expect(ordenesService.onTicketEstadoCambiado).toHaveBeenCalledWith(
        TENANT,
        OT_ID,
      );
    });

    it('falla con Conflict si no está EJECUTADO', async () => {
      mockTicket(TicketEstado.CERRADO, 'mec-1');

      await expect(
        service.cerrar(TENANT, USER, TICKET_ID, {}),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ---------- reasignar ----------

  describe('reasignar', () => {
    function mockReasignChain(opts: {
      estado: TicketEstado;
      currentMec?: string | null;
      profileFound?: boolean;
    }) {
      prisma.ticket.findFirst.mockResolvedValueOnce({
        id: TICKET_ID,
        codigo: 'TKT-2026-0001',
        titulo: 'Falla motor',
        estado: opts.estado,
        otId: OT_ID,
        mecanicoId: opts.currentMec ?? null,
        jefeId: USER,
        fechaValidacion: null,
      });
      prisma.$queryRaw.mockResolvedValueOnce(
        opts.profileFound === false ? [] : [{ id: 'mec-nuevo' }],
      );
      prisma.ticket.update.mockResolvedValue({});
      prisma.eventoEstadoTicket.create.mockResolvedValue({});
      // Para la respuesta final del loadTicketResponse
      prisma.ticket.findFirst.mockResolvedValue(
        fakeTicketRow({ mecanicoId: 'mec-nuevo' }),
      );
      prisma.$queryRaw.mockResolvedValue([]);
    }

    it('reasigna ticket ASIGNADO sin requerir motivo', async () => {
      mockReasignChain({
        estado: TicketEstado.ASIGNADO,
        currentMec: 'mec-anterior',
      });

      await service.reasignar(TENANT, USER, TICKET_ID, {
        mecanicoId: 'mec-nuevo',
      });

      const updArgs = prisma.ticket.update.mock.calls[0][0];
      expect(updArgs.data.mecanicoId).toBe('mec-nuevo');
      // ASIGNADO → ASIGNADO: no toca el estado
      expect(updArgs.data.estado).toBeUndefined();
      expect(updArgs.data.fechaAsignacion).toBeInstanceOf(Date);

      const evtArgs = prisma.eventoEstadoTicket.create.mock.calls[0][0];
      expect(evtArgs.data.estadoAnterior).toBe(TicketEstado.ASIGNADO);
      expect(evtArgs.data.estadoNuevo).toBe(TicketEstado.ASIGNADO);
      expect(evtArgs.data.metadata).toMatchObject({
        tipo: 'REASIGNACION',
        mecanicoAnteriorId: 'mec-anterior',
        mecanicoNuevoId: 'mec-nuevo',
        motivo: null,
      });
    });

    it('reasigna desde EN_EJECUCION exige motivo y vuelve el ticket a ASIGNADO limpiando fechaInicio', async () => {
      mockReasignChain({
        estado: TicketEstado.EN_EJECUCION,
        currentMec: 'mec-anterior',
      });

      await service.reasignar(TENANT, USER, TICKET_ID, {
        mecanicoId: 'mec-nuevo',
        motivo: 'Sobrecarga del mecánico',
      });

      const updArgs = prisma.ticket.update.mock.calls[0][0];
      expect(updArgs.data.estado).toBe(TicketEstado.ASIGNADO);
      expect(updArgs.data.fechaInicioEjecucion).toBeNull();
      expect(updArgs.data.mecanicoId).toBe('mec-nuevo');

      const evtArgs = prisma.eventoEstadoTicket.create.mock.calls[0][0];
      expect(evtArgs.data.metadata.motivo).toBe('Sobrecarga del mecánico');
      expect(evtArgs.data.observacion).toContain('Motivo:');
    });

    it('falla con BadRequest si el ticket EN_EJECUCION viene sin motivo', async () => {
      mockReasignChain({
        estado: TicketEstado.EN_EJECUCION,
        currentMec: 'mec-anterior',
      });

      await expect(
        service.reasignar(TENANT, USER, TICKET_ID, { mecanicoId: 'mec-nuevo' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it.each([
      TicketEstado.PENDIENTE,
      TicketEstado.EJECUTADO,
      TicketEstado.CERRADO,
      TicketEstado.CANCELADO,
    ])(
      'falla con Conflict si el ticket está %s (no reasignable)',
      async (estado) => {
        mockReasignChain({ estado, currentMec: 'mec-anterior' });

        await expect(
          service.reasignar(TENANT, USER, TICKET_ID, {
            mecanicoId: 'mec-nuevo',
            motivo: 'x',
          }),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );

    it('falla con Conflict si reasigna al mismo mecánico actual', async () => {
      mockReasignChain({
        estado: TicketEstado.ASIGNADO,
        currentMec: 'mec-mismo',
      });

      await expect(
        service.reasignar(TENANT, USER, TICKET_ID, {
          mecanicoId: 'mec-mismo',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('falla con NotFound si el nuevo mecánico no existe en el tenant', async () => {
      mockReasignChain({
        estado: TicketEstado.ASIGNADO,
        currentMec: 'mec-anterior',
        profileFound: false,
      });

      await expect(
        service.reasignar(TENANT, USER, TICKET_ID, {
          mecanicoId: 'mec-fantasma',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- carga-mecanicos ----------

  describe('getCargaMecanicos', () => {
    it('agrupa tickets abiertos por mecánico/estado y completa con ceros', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { id: 'mec-1', full_name: 'Juan Pérez', email: 'juan@x.cl' },
        { id: 'mec-2', full_name: 'Ana López', email: 'ana@x.cl' },
      ]);
      prisma.ticket.groupBy.mockResolvedValue([
        {
          mecanicoId: 'mec-1',
          estado: TicketEstado.ASIGNADO,
          _count: { _all: 4 },
        },
        {
          mecanicoId: 'mec-1',
          estado: TicketEstado.EN_EJECUCION,
          _count: { _all: 1 },
        },
        {
          mecanicoId: 'mec-2',
          estado: TicketEstado.PENDIENTE,
          _count: { _all: 2 },
        },
      ]);

      const result = await service.getCargaMecanicos(TENANT);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        mecanicoId: 'mec-1',
        nombre: 'Juan Pérez',
        email: 'juan@x.cl',
        pendientes: 0,
        asignados: 4,
        enEjecucion: 1,
        ejecutados: 0,
        totalAbiertos: 5,
      });
      expect(result[1]).toMatchObject({
        mecanicoId: 'mec-2',
        pendientes: 2,
        totalAbiertos: 2,
      });

      const groupArgs = prisma.ticket.groupBy.mock.calls[0][0];
      expect(groupArgs.where).toMatchObject({ tenantId: TENANT });
      // estados abiertos: PENDIENTE, ASIGNADO, EN_EJECUCION, EJECUTADO
      expect(groupArgs.where.estado.in).toEqual(
        expect.arrayContaining([
          TicketEstado.PENDIENTE,
          TicketEstado.ASIGNADO,
          TicketEstado.EN_EJECUCION,
          TicketEstado.EJECUTADO,
        ]),
      );
      expect(groupArgs.where.estado.in).not.toContain(TicketEstado.CERRADO);
      expect(groupArgs.where.estado.in).not.toContain(TicketEstado.CANCELADO);
    });

    it('devuelve array vacío si el tenant no tiene mecánicos', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.getCargaMecanicos(TENANT);

      expect(result).toEqual([]);
      expect(prisma.ticket.groupBy).not.toHaveBeenCalled();
    });
  });
});
