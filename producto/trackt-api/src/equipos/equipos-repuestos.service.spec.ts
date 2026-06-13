import { ConflictException, NotFoundException } from '@nestjs/common';
import { EquiposRepuestosService } from './equipos-repuestos.service';
import { PrismaService } from '../prisma/prisma.service';

function buildPrismaMock() {
  return {
    equipo: {
      findFirst: jest.fn(),
    },
    repuesto: {
      findFirst: jest.fn(),
    },
    equipoRepuesto: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

const TENANT = 'tenant-1';
const EQUIPO_ID = 'eq-1';
const REPUESTO_ID = 'rep-1';

describe('EquiposRepuestosService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: EquiposRepuestosService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new EquiposRepuestosService(prisma as unknown as PrismaService);
  });

  function mockEquipoOk() {
    prisma.equipo.findFirst.mockResolvedValue({ id: EQUIPO_ID });
  }

  const REPUESTO_ACTIVO = {
    id: REPUESTO_ID,
    codigo: 'FILTRO-001',
    activo: true,
  };

  const ASOCIACION_ROW = {
    id: 'asoc-1',
    equipoId: EQUIPO_ID,
    repuestoId: REPUESTO_ID,
    cantidadRef: 2,
    observacion: null,
    createdAt: new Date(),
    repuesto: {
      id: REPUESTO_ID,
      codigo: 'FILTRO-001',
      nombre: 'Filtro de aceite',
      unidad: 'unidad',
      activo: true,
      marcaId: null,
      stock: { stockActual: 10, stockReservado: 3 },
    },
  };

  // ---------- add ----------

  describe('add', () => {
    it('asocia repuesto del tenant al equipo con cantidadRef', async () => {
      mockEquipoOk();
      prisma.repuesto.findFirst.mockResolvedValue(REPUESTO_ACTIVO);
      prisma.equipoRepuesto.findUnique.mockResolvedValue(null);
      prisma.equipoRepuesto.create.mockResolvedValue(ASOCIACION_ROW);

      const result = await service.add(TENANT, EQUIPO_ID, {
        repuestoId: REPUESTO_ID,
        cantidadRef: 2,
      });

      // Equipo y repuesto verificados con doble filtro id + tenant.
      expect(prisma.equipo.findFirst.mock.calls[0][0].where).toEqual({
        id: EQUIPO_ID,
        tenantId: TENANT,
      });
      expect(prisma.repuesto.findFirst.mock.calls[0][0].where).toEqual({
        id: REPUESTO_ID,
        tenantId: TENANT,
      });

      const createArgs = prisma.equipoRepuesto.create.mock.calls[0][0];
      expect(createArgs.data).toMatchObject({
        tenantId: TENANT,
        equipoId: EQUIPO_ID,
        repuestoId: REPUESTO_ID,
        cantidadRef: 2,
      });
      // El mapper expone stock disponible del repuesto (10 - 3).
      expect(result.repuesto.stockDisponible).toBe(7);
    });

    it('404 si el equipo no existe o es de otro tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);

      await expect(
        service.add(TENANT, EQUIPO_ID, { repuestoId: REPUESTO_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.equipoRepuesto.create).not.toHaveBeenCalled();
    });

    it('404 si el repuesto no existe o es de otro tenant', async () => {
      mockEquipoOk();
      prisma.repuesto.findFirst.mockResolvedValue(null);

      await expect(
        service.add(TENANT, EQUIPO_ID, { repuestoId: 'rep-ajeno' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.equipoRepuesto.create).not.toHaveBeenCalled();
    });

    it('409 si el repuesto está inactivo', async () => {
      mockEquipoOk();
      prisma.repuesto.findFirst.mockResolvedValue({
        ...REPUESTO_ACTIVO,
        activo: false,
      });

      await expect(
        service.add(TENANT, EQUIPO_ID, { repuestoId: REPUESTO_ID }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('409 si la asociación ya existe', async () => {
      mockEquipoOk();
      prisma.repuesto.findFirst.mockResolvedValue(REPUESTO_ACTIVO);
      prisma.equipoRepuesto.findUnique.mockResolvedValue({ id: 'asoc-1' });

      await expect(
        service.add(TENANT, EQUIPO_ID, { repuestoId: REPUESTO_ID }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.equipoRepuesto.create).not.toHaveBeenCalled();
    });
  });

  // ---------- list ----------

  describe('list', () => {
    it('lista las asociaciones del equipo scoped por tenant', async () => {
      mockEquipoOk();
      prisma.equipoRepuesto.findMany.mockResolvedValue([ASOCIACION_ROW]);

      const result = await service.list(TENANT, EQUIPO_ID);

      const args = prisma.equipoRepuesto.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ tenantId: TENANT, equipoId: EQUIPO_ID });
      expect(result).toHaveLength(1);
      expect(result[0].repuesto.codigo).toBe('FILTRO-001');
    });

    it('404 si el equipo no existe en el tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);
      await expect(service.list(TENANT, EQUIPO_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ---------- remove ----------

  describe('remove', () => {
    it('elimina la asociación filtrando por tenant + equipo + repuesto', async () => {
      mockEquipoOk();
      prisma.equipoRepuesto.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.remove(TENANT, EQUIPO_ID, REPUESTO_ID);

      const args = prisma.equipoRepuesto.deleteMany.mock.calls[0][0];
      expect(args.where).toEqual({
        tenantId: TENANT,
        equipoId: EQUIPO_ID,
        repuestoId: REPUESTO_ID,
      });
      expect(result.deleted).toBe(true);
    });

    it('404 si la asociación no existe', async () => {
      mockEquipoOk();
      prisma.equipoRepuesto.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.remove(TENANT, EQUIPO_ID, REPUESTO_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
