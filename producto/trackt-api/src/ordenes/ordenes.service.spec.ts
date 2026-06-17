import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrdenTrabajoEstado, Prioridad, TicketEstado } from '@prisma/client';
import { OrdenesService } from './ordenes.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventarioService } from '../inventario/inventario.service';

/**
 * Mock del PrismaService.
 * `$transaction` soporta los dos contratos que usa el service:
 *  - array: `prisma.$transaction([p1, p2])` → ejecuta y devuelve resultados en orden
 *  - callback: `prisma.$transaction(async (tx) => ...)` → invoca con un "tx" mock
 *    que delega en los mismos métodos de prisma.
 */
function buildPrismaMock() {
  const mock = {
    equipo: {
      findFirst: jest.fn(),
    },
    ordenTrabajo: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    ticket: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([{}]),
    $executeRaw: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn(),
  };

  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      // callback signature → pasamos el mismo mock como "tx"
      return (arg as (tx: typeof mock) => Promise<unknown>)(mock);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    throw new Error('Unexpected $transaction argument');
  });

  return mock;
}

function buildInventarioMock() {
  return {
    liberarReservasDeTicket: jest.fn().mockResolvedValue(undefined),
  };
}

const TENANT = 'tenant-1';
const USER = 'user-admin';
const EQUIPO_ID = 'eq-1';
const OT_ID = 'ot-1';

describe('OrdenesService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let inventario: ReturnType<typeof buildInventarioMock>;
  let service: OrdenesService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    inventario = buildInventarioMock();
    service = new OrdenesService(
      prisma as unknown as PrismaService,
      inventario as unknown as InventarioService,
    );
  });

  // ---------- create ----------

  describe('create', () => {
    beforeEach(() => {
      prisma.equipo.findFirst.mockResolvedValue({ id: EQUIPO_ID });
    });

    it('crea OT en estado PENDIENTE', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null); // no hay códigos previos
      prisma.ordenTrabajo.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: OT_ID, ...data }),
      );

      const result = await service.create(TENANT, USER, {
        equipoId: EQUIPO_ID,
        descripcion: 'Mantención preventiva',
        prioridad: Prioridad.ALTA,
      });

      const createArgs = prisma.ordenTrabajo.create.mock.calls[0][0];
      expect(createArgs.data.estado).toBe(OrdenTrabajoEstado.PENDIENTE);
      expect(createArgs.data.creadoPorId).toBe(USER);
      expect(createArgs.data.tenantId).toBe(TENANT);
      expect(result.estado).toBe(OrdenTrabajoEstado.PENDIENTE);
    });

    it('genera código con formato OT-YYYY-0001 cuando es el primero del año', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null);
      prisma.ordenTrabajo.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: OT_ID, ...data }),
      );

      const year = new Date().getUTCFullYear();
      await service.create(TENANT, USER, {
        equipoId: EQUIPO_ID,
        descripcion: 'x',
      });

      const createArgs = prisma.ordenTrabajo.create.mock.calls[0][0];
      expect(createArgs.data.codigo).toBe(`OT-${year}-0001`);
    });

    it('incrementa la secuencia desde el último código del año', async () => {
      const year = new Date().getUTCFullYear();
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        codigo: `OT-${year}-0041`,
      });
      prisma.ordenTrabajo.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: OT_ID, ...data }),
      );

      await service.create(TENANT, USER, {
        equipoId: EQUIPO_ID,
        descripcion: 'x',
      });

      const createArgs = prisma.ordenTrabajo.create.mock.calls[0][0];
      expect(createArgs.data.codigo).toBe(`OT-${year}-0042`);
    });

    it('toma advisory lock por tenant/año dentro de la transacción', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null);
      prisma.ordenTrabajo.create.mockResolvedValue({ id: OT_ID });

      await service.create(TENANT, USER, {
        equipoId: EQUIPO_ID,
        descripcion: 'x',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('falla si el equipo no existe en el tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT, USER, {
          equipoId: 'no-existe',
          descripcion: 'x',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.ordenTrabajo.create).not.toHaveBeenCalled();
    });
  });

  // ---------- update ----------

  describe('update', () => {
    it('permite actualizar si la OT está PENDIENTE', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });
      prisma.ordenTrabajo.update.mockResolvedValue({
        id: OT_ID,
        descripcion: 'nueva',
      });

      const result = await service.update(TENANT, OT_ID, {
        descripcion: 'nueva',
      });

      expect(prisma.ordenTrabajo.update).toHaveBeenCalled();
      expect(result.descripcion).toBe('nueva');
    });

    it.each([
      OrdenTrabajoEstado.EN_PROCESO,
      OrdenTrabajoEstado.CERRADA,
      OrdenTrabajoEstado.CANCELADA,
    ])('falla con ConflictException si la OT está %s', async (estado) => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({ id: OT_ID, estado });

      await expect(
        service.update(TENANT, OT_ID, { descripcion: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.ordenTrabajo.update).not.toHaveBeenCalled();
    });

    it('falla con NotFoundException si la OT no existe en el tenant', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT, OT_ID, { descripcion: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- cancelar ----------

  describe('cancelar', () => {
    it('cambia estado a CANCELADA cuando viene de PENDIENTE', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });
      prisma.ticket.count.mockResolvedValue(0); // sin tickets activos
      prisma.ticket.findMany.mockResolvedValue([]); // sin pendientes
      prisma.ordenTrabajo.update.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.CANCELADA,
      });

      const result = await service.cancelar(TENANT, USER, OT_ID);

      const updateArgs = prisma.ordenTrabajo.update.mock.calls[0][0];
      expect(updateArgs.data.estado).toBe(OrdenTrabajoEstado.CANCELADA);
      expect(updateArgs.data.fechaCierre).toBeInstanceOf(Date);
      expect(result.estado).toBe(OrdenTrabajoEstado.CANCELADA);
    });

    it('permite cancelar desde EN_PROCESO', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.EN_PROCESO,
      });
      prisma.ticket.count.mockResolvedValue(0);
      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ordenTrabajo.update.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.CANCELADA,
      });

      await expect(
        service.cancelar(TENANT, USER, OT_ID),
      ).resolves.toBeDefined();
    });

    it('bloquea la cancelación si hay tickets activos', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.EN_PROCESO,
      });
      prisma.ticket.count.mockResolvedValue(2); // hay tickets en progreso

      await expect(
        service.cancelar(TENANT, USER, OT_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.ordenTrabajo.update).not.toHaveBeenCalled();
    });

    it('cancela los tickets PENDIENTE y libera sus reservas', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.PENDIENTE,
      });
      prisma.ticket.count.mockResolvedValue(0); // sin activos
      prisma.ticket.findMany.mockResolvedValue([{ id: 't1' }, { id: 't2' }]);
      prisma.ordenTrabajo.update.mockResolvedValue({ id: OT_ID });
      prisma.ticket.updateMany.mockResolvedValue({ count: 2 });

      await service.cancelar(TENANT, USER, OT_ID);

      const ticketArgs = prisma.ticket.updateMany.mock.calls[0][0];
      expect(ticketArgs.where.otId).toBe(OT_ID);
      expect(ticketArgs.where.tenantId).toBe(TENANT);
      expect(ticketArgs.where.estado).toEqual({
        in: [TicketEstado.PENDIENTE],
      });
      expect(ticketArgs.data.estado).toBe(TicketEstado.CANCELADO);
      // Libera reservas de cada ticket cancelado.
      expect(inventario.liberarReservasDeTicket).toHaveBeenCalledTimes(2);
    });

    it.each([OrdenTrabajoEstado.CERRADA, OrdenTrabajoEstado.CANCELADA])(
      'falla con ConflictException si la OT ya está %s',
      async (estado) => {
        prisma.ordenTrabajo.findFirst.mockResolvedValue({ id: OT_ID, estado });

        await expect(
          service.cancelar(TENANT, USER, OT_ID),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.ordenTrabajo.update).not.toHaveBeenCalled();
      },
    );
  });

  // ---------- findOne ----------

  describe('findOne', () => {
    it('incluye tickets relacionados y equipo', async () => {
      const detalle = {
        id: OT_ID,
        codigo: 'OT-2026-0001',
        creadoPorId: USER,
        equipo: { id: EQUIPO_ID, codigo: 'EQ-001', nombre: 'X' },
        tickets: [
          {
            id: 't1',
            codigo: 'TK-1',
            titulo: 'Falla',
            estado: TicketEstado.PENDIENTE,
            prioridad: Prioridad.MEDIA,
            mecanicoId: null,
          },
        ],
      };
      prisma.ordenTrabajo.findFirst.mockResolvedValue(detalle);
      prisma.$queryRaw.mockResolvedValue([]); // sin perfiles hidratados

      const result = await service.findOne(TENANT, OT_ID);

      const findArgs = prisma.ordenTrabajo.findFirst.mock.calls[0][0];
      expect(findArgs.where).toEqual({ id: OT_ID, tenantId: TENANT });
      expect(findArgs.include).toMatchObject({
        equipo: expect.any(Object),
        tickets: expect.any(Object),
      });
      expect(result.tickets).toHaveLength(1);
      // El ticket anidado expone equipo (string) derivado de la OT.
      expect(result.tickets[0].equipo).toBe('EQ-001 - X');
    });

    it('falla con NotFoundException si no existe', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT, OT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ---------- hooks integración tickets ----------

  describe('onTicketEstadoCambiado', () => {
    it('cierra la OT (updateMany guardado) cuando todos los tickets están CERRADOS', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.EN_PROCESO,
      });
      prisma.ticket.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(3); // cerrados
      prisma.ordenTrabajo.updateMany.mockResolvedValue({ count: 1 });

      await service.onTicketEstadoCambiado(TENANT, OT_ID);

      const args = prisma.ordenTrabajo.updateMany.mock.calls[0][0];
      expect(args.where).toMatchObject({
        id: OT_ID,
        tenantId: TENANT,
        estado: OrdenTrabajoEstado.EN_PROCESO,
      });
      expect(args.data.estado).toBe(OrdenTrabajoEstado.CERRADA);
      expect(args.data.fechaCierre).toBeInstanceOf(Date);
    });

    it('no cierra la OT si aún hay tickets no cerrados', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.EN_PROCESO,
      });
      prisma.ticket.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(2); // cerrados

      await service.onTicketEstadoCambiado(TENANT, OT_ID);

      expect(prisma.ordenTrabajo.updateMany).not.toHaveBeenCalled();
    });

    it('no toca OTs que no estén EN_PROCESO (transición inválida bloqueada)', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.CERRADA,
      });

      await service.onTicketEstadoCambiado(TENANT, OT_ID);

      expect(prisma.ticket.count).not.toHaveBeenCalled();
      expect(prisma.ordenTrabajo.updateMany).not.toHaveBeenCalled();
    });

    it('no cierra si la OT no tiene tickets (count total = 0)', async () => {
      prisma.ordenTrabajo.findFirst.mockResolvedValue({
        id: OT_ID,
        estado: OrdenTrabajoEstado.EN_PROCESO,
      });
      prisma.ticket.count.mockResolvedValueOnce(0);

      await service.onTicketEstadoCambiado(TENANT, OT_ID);

      expect(prisma.ordenTrabajo.updateMany).not.toHaveBeenCalled();
    });
  });

  // ---------- findAll ----------

  describe('findAll', () => {
    it('aplica filtros estado y equipoId y siempre filtra por tenant', async () => {
      prisma.ordenTrabajo.findMany.mockResolvedValue([]);
      prisma.ordenTrabajo.count.mockResolvedValue(0);

      await service.findAll(TENANT, {
        estado: OrdenTrabajoEstado.PENDIENTE,
        equipoId: EQUIPO_ID,
        page: 1,
        limit: 10,
      });

      const findArgs = prisma.ordenTrabajo.findMany.mock.calls[0][0];
      expect(findArgs.where).toEqual({
        tenantId: TENANT,
        estado: OrdenTrabajoEstado.PENDIENTE,
        equipoId: EQUIPO_ID,
      });
    });
  });
});
