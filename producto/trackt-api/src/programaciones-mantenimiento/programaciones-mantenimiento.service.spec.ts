import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProgramacionesMantenimientoService } from './programaciones-mantenimiento.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdenesService } from '../ordenes/ordenes.service';
import { TicketsService } from '../tickets/tickets.service';
import { InventarioService } from '../inventario/inventario.service';
import { AuthUser } from '../auth/types';

function buildPrismaMock() {
  const mock = {
    programacionMantenimiento: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    equipo: {
      findFirst: jest.fn(),
    },
    plantillaMantenimiento: {
      findFirst: jest.fn(),
    },
    ordenTrabajo: {
      updateMany: jest.fn(),
    },
    ticket: {
      update: jest.fn(),
    },
    eventoEstadoTicket: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  // Array → Promise.all (listados); callback → ejecutar con el propio mock
  // como tx (generarOt usa transacción interactiva).
  mock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(mock)
      : Promise.all(arg as Promise<unknown>[]),
  );
  return mock;
}

function buildOrdenesMock() {
  return { crearEnTx: jest.fn() };
}

function buildTicketsMock() {
  return { crearEnTx: jest.fn() };
}

function buildInventarioMock() {
  return { crearReservaEnTx: jest.fn() };
}

const TENANT = 'tenant-1';
const PROG_ID = 'prog-1';
const EQUIPO_ID = 'eq-1';
const PLANTILLA_ID = 'pl-1';
const RESPONSABLE_ID = '550e8400-e29b-41d4-a716-446655440000';

// Mañana, siempre futura para assertFechaNoPasada.
function fechaFutura(): string {
  const fecha = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return fecha.toISOString();
}

const EQUIPO_ACTIVO = { id: EQUIPO_ID, codigo: 'EQ-100', activo: true };
const PLANTILLA_ACTIVA = {
  id: PLANTILLA_ID,
  nombre: 'Mantención mensual',
  activo: true,
};

const PROG_ROW = {
  id: PROG_ID,
  tenantId: TENANT,
  equipoId: EQUIPO_ID,
  plantillaId: PLANTILLA_ID,
  titulo: 'Mantención mensual',
  descripcion: null,
  fechaProgramada: new Date('2026-07-01T10:00:00Z'),
  responsableId: null,
  prioridad: 'MEDIA',
  estado: 'PROGRAMADA',
  recurrencia: 'mensual',
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  equipo: { id: EQUIPO_ID, codigo: 'EQ-100', nombre: 'Compresor' },
  plantilla: { id: PLANTILLA_ID, nombre: 'Mantención mensual' },
};

const ADMIN: AuthUser = { id: 'user-admin', role: 'admin', tenantId: TENANT };
const JEFE: AuthUser = {
  id: 'user-jefe',
  role: 'jefe_taller',
  tenantId: TENANT,
};
const MECHANIC: AuthUser = {
  id: 'user-mec',
  role: 'mechanic',
  tenantId: TENANT,
};

describe('ProgramacionesMantenimientoService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let ordenes: ReturnType<typeof buildOrdenesMock>;
  let tickets: ReturnType<typeof buildTicketsMock>;
  let inventario: ReturnType<typeof buildInventarioMock>;
  let service: ProgramacionesMantenimientoService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    ordenes = buildOrdenesMock();
    tickets = buildTicketsMock();
    inventario = buildInventarioMock();
    service = new ProgramacionesMantenimientoService(
      prisma as unknown as PrismaService,
      ordenes as unknown as OrdenesService,
      tickets as unknown as TicketsService,
      inventario as unknown as InventarioService,
    );
  });

  // ---------- create ----------

  describe('create', () => {
    it('crea la programación validando equipo del tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(EQUIPO_ACTIVO);
      prisma.programacionMantenimiento.create.mockResolvedValue(PROG_ROW);

      const result = await service.create(TENANT, {
        equipoId: EQUIPO_ID,
        titulo: '  Cambio de filtros  ',
        fechaProgramada: fechaFutura(),
      });

      expect(prisma.equipo.findFirst.mock.calls[0][0].where).toEqual({
        id: EQUIPO_ID,
        tenantId: TENANT,
      });
      const args = prisma.programacionMantenimiento.create.mock.calls[0][0];
      expect(args.data).toMatchObject({
        tenantId: TENANT,
        equipoId: EQUIPO_ID,
        titulo: 'Cambio de filtros',
      });
      expect(args.data.fechaProgramada).toBeInstanceOf(Date);
      expect(result.id).toBe(PROG_ID);
    });

    it('usa el nombre de la plantilla como título por defecto', async () => {
      prisma.equipo.findFirst.mockResolvedValue(EQUIPO_ACTIVO);
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue(
        PLANTILLA_ACTIVA,
      );
      prisma.programacionMantenimiento.create.mockResolvedValue(PROG_ROW);

      await service.create(TENANT, {
        equipoId: EQUIPO_ID,
        plantillaId: PLANTILLA_ID,
        fechaProgramada: fechaFutura(),
      });

      const args = prisma.programacionMantenimiento.create.mock.calls[0][0];
      expect(args.data.titulo).toBe('Mantención mensual');
      expect(args.data.plantillaId).toBe(PLANTILLA_ID);
    });

    it('400 si no hay título ni plantilla', async () => {
      prisma.equipo.findFirst.mockResolvedValue(EQUIPO_ACTIVO);

      await expect(
        service.create(TENANT, {
          equipoId: EQUIPO_ID,
          fechaProgramada: fechaFutura(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.programacionMantenimiento.create).not.toHaveBeenCalled();
    });

    it('404 si el equipo no existe o es de otro tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT, {
          equipoId: 'eq-ajeno',
          titulo: 'x',
          fechaProgramada: fechaFutura(),
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 si el equipo está inactivo', async () => {
      prisma.equipo.findFirst.mockResolvedValue({
        ...EQUIPO_ACTIVO,
        activo: false,
      });

      await expect(
        service.create(TENANT, {
          equipoId: EQUIPO_ID,
          titulo: 'x',
          fechaProgramada: fechaFutura(),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('404 si la plantilla no existe o es de otro tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(EQUIPO_ACTIVO);
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT, {
          equipoId: EQUIPO_ID,
          plantillaId: 'pl-ajena',
          fechaProgramada: fechaFutura(),
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 si la plantilla está inactiva', async () => {
      prisma.equipo.findFirst.mockResolvedValue(EQUIPO_ACTIVO);
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue({
        ...PLANTILLA_ACTIVA,
        activo: false,
      });

      await expect(
        service.create(TENANT, {
          equipoId: EQUIPO_ID,
          plantillaId: PLANTILLA_ID,
          fechaProgramada: fechaFutura(),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.programacionMantenimiento.create).not.toHaveBeenCalled();
    });

    it('400 si la fecha programada está en el pasado', async () => {
      prisma.equipo.findFirst.mockResolvedValue(EQUIPO_ACTIVO);

      await expect(
        service.create(TENANT, {
          equipoId: EQUIPO_ID,
          titulo: 'x',
          fechaProgramada: '2020-01-01T00:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('valida que el responsable pertenezca al tenant (404 si no)', async () => {
      prisma.equipo.findFirst.mockResolvedValue(EQUIPO_ACTIVO);
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(
        service.create(TENANT, {
          equipoId: EQUIPO_ID,
          titulo: 'x',
          fechaProgramada: fechaFutura(),
          responsableId: RESPONSABLE_ID,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('crea con responsable válido del tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(EQUIPO_ACTIVO);
      prisma.$queryRaw.mockResolvedValue([{ id: RESPONSABLE_ID }]);
      prisma.programacionMantenimiento.create.mockResolvedValue(PROG_ROW);

      await service.create(TENANT, {
        equipoId: EQUIPO_ID,
        titulo: 'x',
        fechaProgramada: fechaFutura(),
        responsableId: RESPONSABLE_ID,
      });

      const args = prisma.programacionMantenimiento.create.mock.calls[0][0];
      expect(args.data.responsableId).toBe(RESPONSABLE_ID);
    });
  });

  // ---------- findAll ----------

  describe('findAll', () => {
    it('aplica filtros de rango, equipo y estado sobre el tenant', async () => {
      prisma.programacionMantenimiento.findMany.mockResolvedValue([PROG_ROW]);
      prisma.programacionMantenimiento.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT, {
        desde: '2026-06-01',
        hasta: '2026-06-30',
        equipoId: EQUIPO_ID,
        estado: 'PROGRAMADA',
      });

      const args = prisma.programacionMantenimiento.findMany.mock.calls[0][0];
      expect(args.where.tenantId).toBe(TENANT);
      expect(args.where.equipoId).toBe(EQUIPO_ID);
      expect(args.where.estado).toBe('PROGRAMADA');
      expect(args.where.fechaProgramada.gte).toBeInstanceOf(Date);
      // hasta date-only es inclusivo: se traduce a lt del día siguiente.
      expect(args.where.fechaProgramada.lt).toEqual(
        new Date('2026-07-01T00:00:00Z'),
      );
      expect(args.orderBy).toEqual({ fechaProgramada: 'asc' });
      expect(result.meta.total).toBe(1);
    });

    it('hasta con hora explícita queda lte exacto', async () => {
      prisma.programacionMantenimiento.findMany.mockResolvedValue([]);
      prisma.programacionMantenimiento.count.mockResolvedValue(0);

      await service.findAll(TENANT, { hasta: '2026-06-30T18:00:00Z' });

      const args = prisma.programacionMantenimiento.findMany.mock.calls[0][0];
      expect(args.where.fechaProgramada).toEqual({
        lte: new Date('2026-06-30T18:00:00Z'),
      });
    });

    it('400 si desde es posterior a hasta', async () => {
      await expect(
        service.findAll(TENANT, {
          desde: '2026-07-01',
          hasta: '2026-06-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ---------- calendario ----------

  describe('calendario', () => {
    it('devuelve eventos planos para el frontend', async () => {
      prisma.programacionMantenimiento.findMany.mockResolvedValue([PROG_ROW]);

      const result = await service.calendario(TENANT, {
        desde: '2026-06-01',
        hasta: '2026-07-31',
      });

      expect(result).toEqual([
        {
          id: PROG_ID,
          title: 'Mantención mensual',
          start: PROG_ROW.fechaProgramada,
          estado: 'PROGRAMADA',
          prioridad: 'MEDIA',
          equipo: { id: EQUIPO_ID, codigo: 'EQ-100', nombre: 'Compresor' },
          plantilla: { id: PLANTILLA_ID, nombre: 'Mantención mensual' },
        },
      ]);
      const args = prisma.programacionMantenimiento.findMany.mock.calls[0][0];
      expect(args.where.tenantId).toBe(TENANT);
    });

    it('plantilla null cuando la programación no tiene plantilla', async () => {
      prisma.programacionMantenimiento.findMany.mockResolvedValue([
        { ...PROG_ROW, plantillaId: null, plantilla: null },
      ]);

      const result = await service.calendario(TENANT, {
        desde: '2026-06-01',
        hasta: '2026-06-30',
      });
      expect(result[0].plantilla).toBeNull();
    });

    it('400 si el rango está invertido o supera el máximo', async () => {
      await expect(
        service.calendario(TENANT, {
          desde: '2026-07-01',
          hasta: '2026-06-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.calendario(TENANT, {
          desde: '2026-01-01',
          hasta: '2028-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ---------- findOne ----------

  describe('findOne', () => {
    it('devuelve la programación con equipo y plantilla', async () => {
      prisma.programacionMantenimiento.findFirst.mockResolvedValue(PROG_ROW);

      const result = await service.findOne(TENANT, PROG_ID);

      const args = prisma.programacionMantenimiento.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ id: PROG_ID, tenantId: TENANT });
      expect(result.equipo.codigo).toBe('EQ-100');
    });

    it('404 si no existe o es de otro tenant', async () => {
      prisma.programacionMantenimiento.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT, PROG_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ---------- update ----------

  describe('update', () => {
    function mockProgramada() {
      prisma.programacionMantenimiento.findFirst.mockResolvedValue({
        ...PROG_ROW,
        estado: 'PROGRAMADA',
      });
      // El write es updateMany condicionado al estado (guard anti-TOCTOU);
      // el retorno sale de findOne (findFirst de arriba).
      prisma.programacionMantenimiento.updateMany.mockResolvedValue({
        count: 1,
      });
    }

    it('actualiza campos en estado PROGRAMADA con write condicionado', async () => {
      mockProgramada();

      await service.update(TENANT, PROG_ID, {
        titulo: '  Nueva mantención  ',
        prioridad: 'ALTA',
      });

      const args = prisma.programacionMantenimiento.updateMany.mock.calls[0][0];
      expect(args.where).toEqual({
        id: PROG_ID,
        tenantId: TENANT,
        estado: 'PROGRAMADA',
      });
      expect(args.data).toEqual({
        titulo: 'Nueva mantención',
        prioridad: 'ALTA',
      });
    });

    it('400 si no se especifica ningún campo', async () => {
      await expect(service.update(TENANT, PROG_ID, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('404 si no existe en el tenant', async () => {
      prisma.programacionMantenimiento.findFirst.mockResolvedValue(null);
      await expect(
        service.update(TENANT, PROG_ID, { titulo: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 si la programación no está PROGRAMADA', async () => {
      prisma.programacionMantenimiento.findFirst.mockResolvedValue({
        id: PROG_ID,
        estado: 'GENERADA',
      });

      await expect(
        service.update(TENANT, PROG_ID, { titulo: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(
        prisma.programacionMantenimiento.updateMany,
      ).not.toHaveBeenCalled();
    });

    it('409 si la programación cambió de estado entre el check y el write (count=0)', async () => {
      // Carrera: el check inicial la ve PROGRAMADA, pero una cancelación
      // concurrente gana — el updateMany condicionado no matchea.
      prisma.programacionMantenimiento.findFirst
        .mockResolvedValueOnce({ id: PROG_ID, estado: 'PROGRAMADA' })
        .mockResolvedValueOnce({ estado: 'CANCELADA' });
      prisma.programacionMantenimiento.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.update(TENANT, PROG_ID, { titulo: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('404 si la programación desapareció entre el check y el write (count=0)', async () => {
      prisma.programacionMantenimiento.findFirst
        .mockResolvedValueOnce({ id: PROG_ID, estado: 'PROGRAMADA' })
        .mockResolvedValueOnce(null);
      prisma.programacionMantenimiento.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.update(TENANT, PROG_ID, { titulo: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('400 si la nueva fecha está en el pasado', async () => {
      mockProgramada();
      await expect(
        service.update(TENANT, PROG_ID, {
          fechaProgramada: '2020-01-01T00:00:00Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('valida la nueva plantilla y permite desvincular con null', async () => {
      mockProgramada();
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue({
        ...PLANTILLA_ACTIVA,
        activo: false,
      });

      await expect(
        service.update(TENANT, PROG_ID, { plantillaId: PLANTILLA_ID }),
      ).rejects.toBeInstanceOf(ConflictException);

      await service.update(TENANT, PROG_ID, { plantillaId: null });
      const args = prisma.programacionMantenimiento.updateMany.mock.calls[0][0];
      expect(args.data).toEqual({ plantillaId: null });
    });

    it('quita el responsable con null y valida el nuevo si viene', async () => {
      mockProgramada();

      await service.update(TENANT, PROG_ID, { responsableId: null });
      let args = prisma.programacionMantenimiento.updateMany.mock.calls[0][0];
      expect(args.data).toEqual({ responsableId: null });

      prisma.$queryRaw.mockResolvedValue([{ id: RESPONSABLE_ID }]);
      await service.update(TENANT, PROG_ID, { responsableId: RESPONSABLE_ID });
      args = prisma.programacionMantenimiento.updateMany.mock.calls[1][0];
      expect(args.data).toEqual({ responsableId: RESPONSABLE_ID });
    });
  });

  // ---------- cancelar ----------

  describe('cancelar', () => {
    it('cancela una programación PROGRAMADA con guard anti-TOCTOU', async () => {
      prisma.programacionMantenimiento.findFirst
        .mockResolvedValueOnce({ id: PROG_ID, estado: 'PROGRAMADA' })
        .mockResolvedValueOnce({ ...PROG_ROW, estado: 'CANCELADA' });
      prisma.programacionMantenimiento.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.cancelar(TENANT, PROG_ID);

      const args = prisma.programacionMantenimiento.updateMany.mock.calls[0][0];
      expect(args.where).toEqual({
        id: PROG_ID,
        tenantId: TENANT,
        estado: 'PROGRAMADA',
      });
      expect(args.data).toEqual({ estado: 'CANCELADA' });
      expect(result.estado).toBe('CANCELADA');
    });

    it('404 si no existe en el tenant', async () => {
      prisma.programacionMantenimiento.findFirst.mockResolvedValue(null);
      await expect(service.cancelar(TENANT, PROG_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('409 si ya no está PROGRAMADA (carrera o estado final)', async () => {
      prisma.programacionMantenimiento.findFirst.mockResolvedValue({
        id: PROG_ID,
        estado: 'CANCELADA',
      });
      prisma.programacionMantenimiento.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(service.cancelar(TENANT, PROG_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  // ---------- generarOt (flujo principal Fase 5) ----------

  describe('generarOt', () => {
    const OT = { id: 'ot-1', codigo: 'OT-2026-0001' };
    const TICKET = { id: 'tkt-1', codigo: 'TKT-2026-0001' };
    const RESERVA = { id: 'res-1', estado: 'RESERVADA' };

    const PROG_BASE = {
      id: PROG_ID,
      tenantId: TENANT,
      equipoId: EQUIPO_ID,
      titulo: 'Mantención mensual',
      descripcion: null,
      prioridad: 'MEDIA',
      estado: 'PROGRAMADA',
      metadata: null,
    };

    const PLANTILLA_CON_ITEMS = {
      id: PLANTILLA_ID,
      nombre: 'Mantención mensual',
      items: [
        {
          repuestoId: 'rep-1',
          cantidad: 2,
          obligatorio: true,
          repuesto: {
            codigo: 'FILTRO-001',
            nombre: 'Filtro de aire',
            unidad: 'unidad',
            stock: { stockActual: 10, stockReservado: 3 },
          },
        },
        {
          repuestoId: 'rep-2',
          cantidad: 1,
          obligatorio: false,
          repuesto: {
            codigo: 'GRASA-001',
            nombre: 'Grasa industrial',
            unidad: 'kg',
            stock: { stockActual: 5, stockReservado: 0 },
          },
        },
      ],
    };

    function mockGeneracionOk(opts?: { plantilla?: unknown }) {
      prisma.programacionMantenimiento.findFirst.mockResolvedValue({
        ...PROG_BASE,
        plantilla: opts?.plantilla ?? null,
      });
      prisma.equipo.findFirst.mockResolvedValue({
        id: EQUIPO_ID,
        codigo: 'EQ-100',
        activo: true,
      });
      prisma.programacionMantenimiento.updateMany.mockResolvedValue({
        count: 1,
      });
      // Relectura de metadata dentro de la tx antes del update final.
      prisma.programacionMantenimiento.findUniqueOrThrow.mockResolvedValue({
        metadata: PROG_BASE.metadata,
      });
      prisma.ordenTrabajo.updateMany.mockResolvedValue({ count: 1 });
      ordenes.crearEnTx.mockResolvedValue(OT);
      tickets.crearEnTx.mockResolvedValue(TICKET);
      // Auto-asignación cuando genera un mechanic.
      prisma.ticket.update.mockResolvedValue({
        ...TICKET,
        estado: 'ASIGNADO',
        mecanicoId: MECHANIC.id,
      });
      prisma.eventoEstadoTicket.create.mockResolvedValue({ id: 'evt-1' });
      inventario.crearReservaEnTx.mockResolvedValue(RESERVA);
      prisma.programacionMantenimiento.update.mockResolvedValue({
        ...PROG_BASE,
        estado: 'GENERADA',
      });
    }

    it('genera OT + ticket sin plantilla (sin reserva) y marca GENERADA', async () => {
      mockGeneracionOk();

      const result = await service.generarOt(TENANT, ADMIN, PROG_ID, {});

      // Guard anti doble generación condicionado al estado.
      const marcada =
        prisma.programacionMantenimiento.updateMany.mock.calls[0][0];
      expect(marcada.where).toEqual({
        id: PROG_ID,
        tenantId: TENANT,
        estado: 'PROGRAMADA',
      });
      expect(marcada.data).toEqual({ estado: 'GENERADA' });

      // OT y ticket creados dentro de la misma tx (mismo objeto tx = prisma mock).
      expect(ordenes.crearEnTx).toHaveBeenCalledWith(
        prisma,
        TENANT,
        ADMIN.id,
        expect.objectContaining({
          equipoId: EQUIPO_ID,
          descripcion: 'Mantención mensual',
          metadata: { programacionId: PROG_ID },
        }),
      );
      expect(tickets.crearEnTx).toHaveBeenCalledWith(
        prisma,
        TENANT,
        ADMIN.id,
        OT.id,
        expect.objectContaining({
          titulo: 'Mantención mensual',
          metadata: { programacionId: PROG_ID },
        }),
      );
      // OT PENDIENTE → EN_PROCESO con guard.
      const transicion = prisma.ordenTrabajo.updateMany.mock.calls[0][0];
      expect(transicion.where).toEqual({
        id: OT.id,
        tenantId: TENANT,
        estado: 'PENDIENTE',
      });

      // Sin plantilla: no hay reserva.
      expect(inventario.crearReservaEnTx).not.toHaveBeenCalled();
      expect(result.reserva).toBeNull();

      // Trazabilidad en metadata.
      const metaUpdate =
        prisma.programacionMantenimiento.update.mock.calls[0][0];
      expect(metaUpdate.data.metadata.generacion).toMatchObject({
        otId: OT.id,
        otCodigo: OT.codigo,
        ticketId: TICKET.id,
        ticketCodigo: TICKET.codigo,
        reservaId: null,
        generadoPorId: ADMIN.id,
      });
    });

    it('genera con plantilla: crea reserva con los insumos de la receta', async () => {
      mockGeneracionOk({ plantilla: PLANTILLA_CON_ITEMS });

      const result = await service.generarOt(TENANT, ADMIN, PROG_ID, {});

      expect(inventario.crearReservaEnTx).toHaveBeenCalledWith(
        prisma,
        TENANT,
        ADMIN,
        TICKET.id,
        expect.objectContaining({
          items: [
            { repuestoId: 'rep-1', cantidad: 2 },
            { repuestoId: 'rep-2', cantidad: 1 },
          ],
          solicitar: false,
        }),
      );
      expect(result.reserva).toEqual(RESERVA);
      const metaUpdate =
        prisma.programacionMantenimiento.update.mock.calls[0][0];
      expect(metaUpdate.data.metadata.generacion.reservaId).toBe(RESERVA.id);
    });

    it('reserva queda solicitada=false para jefe_taller (RESERVADA)', async () => {
      mockGeneracionOk({ plantilla: PLANTILLA_CON_ITEMS });

      await service.generarOt(TENANT, JEFE, PROG_ID, {});

      const params = inventario.crearReservaEnTx.mock.calls[0][4];
      expect(params.solicitar).toBe(false);
    });

    it('reserva queda solicitar=true para mechanic (SOLICITADA)', async () => {
      mockGeneracionOk({ plantilla: PLANTILLA_CON_ITEMS });
      inventario.crearReservaEnTx.mockResolvedValue({
        id: 'res-1',
        estado: 'SOLICITADA',
      });

      const result = await service.generarOt(TENANT, MECHANIC, PROG_ID, {});

      const params = inventario.crearReservaEnTx.mock.calls[0][4];
      expect(params.solicitar).toBe(true);
      expect(result.reserva.estado).toBe('SOLICITADA');
    });

    it('mechanic: auto-asigna el ticket (ASIGNADO + evento) en la misma tx', async () => {
      mockGeneracionOk();

      const result = await service.generarOt(TENANT, MECHANIC, PROG_ID, {});

      const updateArgs = prisma.ticket.update.mock.calls[0][0];
      expect(updateArgs.where).toEqual({ id: TICKET.id });
      expect(updateArgs.data).toMatchObject({
        estado: 'ASIGNADO',
        mecanicoId: MECHANIC.id,
      });
      expect(updateArgs.data.fechaAsignacion).toBeInstanceOf(Date);

      const eventoArgs = prisma.eventoEstadoTicket.create.mock.calls[0][0];
      expect(eventoArgs.data).toMatchObject({
        ticketId: TICKET.id,
        estadoAnterior: 'PENDIENTE',
        estadoNuevo: 'ASIGNADO',
        usuarioId: MECHANIC.id,
      });
      expect(result.ticket.mecanicoId).toBe(MECHANIC.id);
    });

    it('admin/jefe: el ticket queda PENDIENTE sin auto-asignación', async () => {
      mockGeneracionOk();

      await service.generarOt(TENANT, ADMIN, PROG_ID, {});

      expect(prisma.ticket.update).not.toHaveBeenCalled();
      expect(prisma.eventoEstadoTicket.create).not.toHaveBeenCalled();
    });

    it('la trazabilidad usa la metadata releída dentro de la tx (no la pre-tx)', async () => {
      mockGeneracionOk();
      // findFirst (pre-tx) trae metadata vieja; un PATCH concurrente dejó
      // otra — el merge debe partir de la fresca.
      prisma.programacionMantenimiento.findFirst.mockResolvedValue({
        ...PROG_BASE,
        metadata: { vieja: true },
        plantilla: null,
      });
      prisma.programacionMantenimiento.findUniqueOrThrow.mockResolvedValue({
        metadata: { fresca: true },
      });

      await service.generarOt(TENANT, ADMIN, PROG_ID, {});

      const metaUpdate =
        prisma.programacionMantenimiento.update.mock.calls[0][0];
      expect(metaUpdate.data.metadata.fresca).toBe(true);
      expect(metaUpdate.data.metadata.vieja).toBeUndefined();
      expect(metaUpdate.data.metadata.generacion).toBeDefined();
    });

    it('aplica ajustarItems: reemplaza cantidades y 0 excluye el insumo', async () => {
      mockGeneracionOk({ plantilla: PLANTILLA_CON_ITEMS });

      await service.generarOt(TENANT, ADMIN, PROG_ID, {
        ajustarItems: [
          { repuestoId: 'rep-1', cantidad: 5 },
          { repuestoId: 'rep-2', cantidad: 0 },
        ],
      });

      const params = inventario.crearReservaEnTx.mock.calls[0][4];
      expect(params.items).toEqual([{ repuestoId: 'rep-1', cantidad: 5 }]);
    });

    it('400 si se excluye (cantidad 0) un insumo obligatorio', async () => {
      mockGeneracionOk({ plantilla: PLANTILLA_CON_ITEMS });

      await expect(
        service.generarOt(TENANT, ADMIN, PROG_ID, {
          // rep-1 es obligatorio en la plantilla.
          ajustarItems: [{ repuestoId: 'rep-1', cantidad: 0 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(ordenes.crearEnTx).not.toHaveBeenCalled();
    });

    it('400 si ajustarItems repite un repuestoId', async () => {
      mockGeneracionOk({ plantilla: PLANTILLA_CON_ITEMS });

      await expect(
        service.generarOt(TENANT, ADMIN, PROG_ID, {
          ajustarItems: [
            { repuestoId: 'rep-1', cantidad: 5 },
            { repuestoId: 'rep-1', cantidad: 2 },
          ],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(ordenes.crearEnTx).not.toHaveBeenCalled();
    });

    it('400 si ajustarItems referencia un repuesto fuera de la plantilla', async () => {
      mockGeneracionOk({ plantilla: PLANTILLA_CON_ITEMS });

      await expect(
        service.generarOt(TENANT, ADMIN, PROG_ID, {
          ajustarItems: [{ repuestoId: 'rep-ajeno', cantidad: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(ordenes.crearEnTx).not.toHaveBeenCalled();
    });

    it('400 si se envía ajustarItems sin plantilla', async () => {
      mockGeneracionOk();

      await expect(
        service.generarOt(TENANT, ADMIN, PROG_ID, {
          ajustarItems: [{ repuestoId: 'rep-1', cantidad: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('modo SUGERIDA: genera OT/ticket sin reserva y devuelve itemsSugeridos', async () => {
      mockGeneracionOk({ plantilla: PLANTILLA_CON_ITEMS });

      const result = await service.generarOt(TENANT, ADMIN, PROG_ID, {
        modoReserva: 'SUGERIDA',
      });

      expect(inventario.crearReservaEnTx).not.toHaveBeenCalled();
      expect(result.reserva).toBeNull();
      // GENERADA igual se marca: el ticket ya existe para reservar después.
      expect(prisma.programacionMantenimiento.updateMany).toHaveBeenCalled();
      expect(result.itemsSugeridos).toEqual([
        expect.objectContaining({
          repuestoId: 'rep-1',
          cantidad: 2,
          repuesto: expect.objectContaining({
            codigo: 'FILTRO-001',
            stockDisponible: 7,
          }),
        }),
        expect.objectContaining({ repuestoId: 'rep-2', cantidad: 1 }),
      ]);
    });

    it('stock insuficiente: la excepción de la reserva aborta la tx (sin OT/ticket huérfanos)', async () => {
      mockGeneracionOk({ plantilla: PLANTILLA_CON_ITEMS });
      const stockError = new ConflictException({
        message: 'Stock insuficiente para generar reserva',
        faltantes: [
          {
            repuestoId: 'rep-1',
            codigo: 'FILTRO-001',
            nombre: 'Filtro de aire',
            requerido: 2,
            disponible: 1,
          },
        ],
      });
      inventario.crearReservaEnTx.mockRejectedValue(stockError);

      await expect(service.generarOt(TENANT, ADMIN, PROG_ID, {})).rejects.toBe(
        stockError,
      );

      // El error nace DENTRO del callback de $transaction → en BD real todo
      // (OT, ticket, GENERADA) se revierte junto. La metadata nunca se grabó.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.programacionMantenimiento.update).not.toHaveBeenCalled();
    });

    it('409 si la programación no está PROGRAMADA (no generar dos veces)', async () => {
      prisma.programacionMantenimiento.findFirst.mockResolvedValue({
        ...PROG_BASE,
        estado: 'GENERADA',
        plantilla: null,
      });

      await expect(
        service.generarOt(TENANT, ADMIN, PROG_ID, {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(ordenes.crearEnTx).not.toHaveBeenCalled();
    });

    it('409 si otra request la generó en paralelo (guard updateMany count=0)', async () => {
      mockGeneracionOk();
      prisma.programacionMantenimiento.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.generarOt(TENANT, ADMIN, PROG_ID, {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(ordenes.crearEnTx).not.toHaveBeenCalled();
    });

    it('404 si la programación es de otro tenant', async () => {
      prisma.programacionMantenimiento.findFirst.mockResolvedValue(null);

      await expect(
        service.generarOt(TENANT, ADMIN, PROG_ID, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
      const args = prisma.programacionMantenimiento.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ id: PROG_ID, tenantId: TENANT });
    });

    it('409 si el equipo está inactivo', async () => {
      mockGeneracionOk();
      prisma.equipo.findFirst.mockResolvedValue({
        id: EQUIPO_ID,
        codigo: 'EQ-100',
        activo: false,
      });

      await expect(
        service.generarOt(TENANT, ADMIN, PROG_ID, {}),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(ordenes.crearEnTx).not.toHaveBeenCalled();
    });
  });
});
