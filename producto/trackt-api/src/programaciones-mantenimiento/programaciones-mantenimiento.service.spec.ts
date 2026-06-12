import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProgramacionesMantenimientoService } from './programaciones-mantenimiento.service';
import { PrismaService } from '../prisma/prisma.service';

function buildPrismaMock() {
  return {
    programacionMantenimiento: {
      findFirst: jest.fn(),
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
    $queryRaw: jest.fn(),
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
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

describe('ProgramacionesMantenimientoService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: ProgramacionesMantenimientoService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new ProgramacionesMantenimientoService(
      prisma as unknown as PrismaService,
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
      expect(args.where.fechaProgramada.lte).toBeInstanceOf(Date);
      expect(args.orderBy).toEqual({ fechaProgramada: 'asc' });
      expect(result.meta.total).toBe(1);
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
        id: PROG_ID,
        estado: 'PROGRAMADA',
      });
    }

    it('actualiza campos en estado PROGRAMADA', async () => {
      mockProgramada();
      prisma.programacionMantenimiento.update.mockResolvedValue(PROG_ROW);

      await service.update(TENANT, PROG_ID, {
        titulo: '  Nueva mantención  ',
        prioridad: 'ALTA',
      });

      const args = prisma.programacionMantenimiento.update.mock.calls[0][0];
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
      expect(prisma.programacionMantenimiento.update).not.toHaveBeenCalled();
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

      prisma.programacionMantenimiento.update.mockResolvedValue(PROG_ROW);
      await service.update(TENANT, PROG_ID, { plantillaId: null });
      const args = prisma.programacionMantenimiento.update.mock.calls[0][0];
      expect(args.data).toEqual({ plantillaId: null });
    });

    it('quita el responsable con null y valida el nuevo si viene', async () => {
      mockProgramada();
      prisma.programacionMantenimiento.update.mockResolvedValue(PROG_ROW);

      await service.update(TENANT, PROG_ID, { responsableId: null });
      let args = prisma.programacionMantenimiento.update.mock.calls[0][0];
      expect(args.data).toEqual({ responsableId: null });

      prisma.$queryRaw.mockResolvedValue([{ id: RESPONSABLE_ID }]);
      await service.update(TENANT, PROG_ID, { responsableId: RESPONSABLE_ID });
      args = prisma.programacionMantenimiento.update.mock.calls[1][0];
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
});
