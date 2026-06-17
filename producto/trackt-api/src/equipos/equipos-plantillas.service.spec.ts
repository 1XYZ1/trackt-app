import { ConflictException, NotFoundException } from '@nestjs/common';
import { EquiposPlantillasService } from './equipos-plantillas.service';
import { PrismaService } from '../prisma/prisma.service';

function buildPrismaMock() {
  const prisma = {
    equipo: {
      findFirst: jest.fn(),
    },
    plantillaMantenimiento: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    equipoPlantillaMantenimiento: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    // add() corre dentro de una transacción interactiva: el callback recibe
    // el mismo mock como tx (patrón de los otros specs del repo).
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (fn: (tx: typeof prisma) => unknown) => fn(prisma),
  );
  return prisma;
}

const TENANT = 'tenant-1';
const EQUIPO_ID = 'eq-1';
const PLANTILLA_ID = 'pl-1';

const PLANTILLA_ACTIVA = {
  id: PLANTILLA_ID,
  nombre: 'Mantención mensual',
  activo: true,
};

const ASOCIACION_ROW = {
  id: 'asoc-1',
  equipoId: EQUIPO_ID,
  plantillaId: PLANTILLA_ID,
  createdAt: new Date(),
  plantilla: {
    id: PLANTILLA_ID,
    nombre: 'Mantención mensual',
    descripcion: null,
    tipoEquipo: 'compresor',
    frecuencia: 'mensual',
    activo: true,
    _count: { items: 3 },
  },
};

describe('EquiposPlantillasService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: EquiposPlantillasService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new EquiposPlantillasService(prisma as unknown as PrismaService);
  });

  function mockEquipoOk() {
    prisma.equipo.findFirst.mockResolvedValue({ id: EQUIPO_ID });
  }

  function mockPlantillaSigueActiva() {
    // Re-check post-create dentro de la tx: por defecto sigue activa.
    prisma.plantillaMantenimiento.findUniqueOrThrow.mockResolvedValue({
      activo: true,
      nombre: PLANTILLA_ACTIVA.nombre,
    });
  }

  // ---------- add ----------

  describe('add', () => {
    it('asocia la plantilla validando tenant en equipo y plantilla', async () => {
      mockEquipoOk();
      mockPlantillaSigueActiva();
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue(
        PLANTILLA_ACTIVA,
      );
      prisma.equipoPlantillaMantenimiento.findUnique.mockResolvedValue(null);
      prisma.equipoPlantillaMantenimiento.create.mockResolvedValue(
        ASOCIACION_ROW,
      );

      const result = await service.add(TENANT, EQUIPO_ID, PLANTILLA_ID);

      expect(prisma.equipo.findFirst.mock.calls[0][0].where).toEqual({
        id: EQUIPO_ID,
        tenantId: TENANT,
      });
      expect(
        prisma.plantillaMantenimiento.findFirst.mock.calls[0][0].where,
      ).toEqual({ id: PLANTILLA_ID, tenantId: TENANT });

      const createArgs =
        prisma.equipoPlantillaMantenimiento.create.mock.calls[0][0];
      expect(createArgs.data).toEqual({
        tenantId: TENANT,
        equipoId: EQUIPO_ID,
        plantillaId: PLANTILLA_ID,
      });
      expect(result.plantilla.itemsCount).toBe(3);
    });

    it('404 si el equipo no existe o es de otro tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);

      await expect(
        service.add(TENANT, EQUIPO_ID, PLANTILLA_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.equipoPlantillaMantenimiento.create).not.toHaveBeenCalled();
    });

    it('404 si la plantilla no existe o es de otro tenant', async () => {
      mockEquipoOk();
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue(null);

      await expect(
        service.add(TENANT, EQUIPO_ID, 'pl-ajena'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 si la plantilla está inactiva', async () => {
      mockEquipoOk();
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue({
        ...PLANTILLA_ACTIVA,
        activo: false,
      });

      await expect(
        service.add(TENANT, EQUIPO_ID, PLANTILLA_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.equipoPlantillaMantenimiento.create).not.toHaveBeenCalled();
    });

    it('409 si la asociación ya existe', async () => {
      mockEquipoOk();
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue(
        PLANTILLA_ACTIVA,
      );
      prisma.equipoPlantillaMantenimiento.findUnique.mockResolvedValue({
        id: 'asoc-1',
      });

      await expect(
        service.add(TENANT, EQUIPO_ID, PLANTILLA_ID),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.equipoPlantillaMantenimiento.create).not.toHaveBeenCalled();
    });

    it('409 si la plantilla se desactiva durante la transacción (re-check post-create)', async () => {
      mockEquipoOk();
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue(
        PLANTILLA_ACTIVA,
      );
      prisma.equipoPlantillaMantenimiento.findUnique.mockResolvedValue(null);
      prisma.equipoPlantillaMantenimiento.create.mockResolvedValue(
        ASOCIACION_ROW,
      );
      // Desactivación concurrente commiteada entre el check inicial y el
      // re-check: la tx debe revertir con 409.
      prisma.plantillaMantenimiento.findUniqueOrThrow.mockResolvedValue({
        activo: false,
        nombre: PLANTILLA_ACTIVA.nombre,
      });

      await expect(
        service.add(TENANT, EQUIPO_ID, PLANTILLA_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ---------- list ----------

  describe('list', () => {
    it('lista las plantillas del equipo scoped por tenant', async () => {
      mockEquipoOk();
      prisma.equipoPlantillaMantenimiento.findMany.mockResolvedValue([
        ASOCIACION_ROW,
      ]);

      const result = await service.list(TENANT, EQUIPO_ID);

      const args =
        prisma.equipoPlantillaMantenimiento.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ tenantId: TENANT, equipoId: EQUIPO_ID });
      expect(result).toHaveLength(1);
      expect(result[0].plantilla.nombre).toBe('Mantención mensual');
      expect(result[0].plantilla.itemsCount).toBe(3);
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
    it('elimina la asociación filtrando por tenant + equipo + plantilla', async () => {
      mockEquipoOk();
      prisma.equipoPlantillaMantenimiento.deleteMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.remove(TENANT, EQUIPO_ID, PLANTILLA_ID);

      const args =
        prisma.equipoPlantillaMantenimiento.deleteMany.mock.calls[0][0];
      expect(args.where).toEqual({
        tenantId: TENANT,
        equipoId: EQUIPO_ID,
        plantillaId: PLANTILLA_ID,
      });
      expect(result.deleted).toBe(true);
    });

    it('404 si la asociación no existe', async () => {
      mockEquipoOk();
      prisma.equipoPlantillaMantenimiento.deleteMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.remove(TENANT, EQUIPO_ID, PLANTILLA_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
