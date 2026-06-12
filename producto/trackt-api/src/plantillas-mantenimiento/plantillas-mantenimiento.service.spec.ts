import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PlantillasMantenimientoService } from './plantillas-mantenimiento.service';
import { PrismaService } from '../prisma/prisma.service';

function buildPrismaMock() {
  const prisma = {
    plantillaMantenimiento: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    plantillaMantenimientoItem: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    repuesto: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    // $transaction en ambas formas: array (findAll) y callback interactivo
    // (addItem), donde el tx es el mismo mock.
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg);
    return (arg as (tx: typeof prisma) => unknown)(prisma);
  });
  return prisma;
}

const TENANT = 'tenant-1';
const PLANTILLA_ID = 'pl-1';
const REPUESTO_ID = 'rep-1';
const ITEM_ID = 'item-1';

const PLANTILLA = {
  id: PLANTILLA_ID,
  nombre: 'Mantención mensual de compresor',
  descripcion: null,
  tipoEquipo: 'compresor',
  frecuencia: 'mensual',
  activo: true,
  metadata: { checklist: ['Revisar presión', 'Cambiar filtro'] },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ITEM_ROW = {
  id: ITEM_ID,
  plantillaId: PLANTILLA_ID,
  repuestoId: REPUESTO_ID,
  cantidad: 2,
  obligatorio: true,
  observacion: null,
  repuesto: {
    id: REPUESTO_ID,
    codigo: 'FILTRO-001',
    nombre: 'Filtro de aire',
    unidad: 'unidad',
    activo: true,
    marcaId: null,
    stock: { stockActual: 10, stockReservado: 3 },
  },
};

describe('PlantillasMantenimientoService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: PlantillasMantenimientoService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new PlantillasMantenimientoService(
      prisma as unknown as PrismaService,
    );
  });

  function mockPlantillaOk() {
    prisma.plantillaMantenimiento.findFirst.mockResolvedValue({
      id: PLANTILLA_ID,
    });
  }

  // ---------- create ----------

  describe('create', () => {
    it('crea la plantilla con nombre normalizado y opcionales trim', async () => {
      prisma.plantillaMantenimiento.create.mockResolvedValue(PLANTILLA);

      await service.create(TENANT, {
        nombre: '  Mantención mensual  ',
        descripcion: '  con filtro  ',
        tipoEquipo: 'compresor',
        frecuencia: 'mensual',
      });

      const args = prisma.plantillaMantenimiento.create.mock.calls[0][0];
      expect(args.data).toMatchObject({
        tenantId: TENANT,
        nombre: 'Mantención mensual',
        descripcion: 'con filtro',
        tipoEquipo: 'compresor',
        frecuencia: 'mensual',
      });
    });

    it('normaliza opcionales vacíos a null', async () => {
      prisma.plantillaMantenimiento.create.mockResolvedValue(PLANTILLA);

      await service.create(TENANT, {
        nombre: 'Plantilla',
        descripcion: '   ',
        frecuencia: '',
      });

      const args = prisma.plantillaMantenimiento.create.mock.calls[0][0];
      expect(args.data.descripcion).toBeNull();
      expect(args.data.frecuencia).toBeNull();
    });

    it('400 si nombre es solo espacios', async () => {
      await expect(
        service.create(TENANT, { nombre: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.plantillaMantenimiento.create).not.toHaveBeenCalled();
    });

    it('acepta metadata.checklist como arreglo de strings', async () => {
      prisma.plantillaMantenimiento.create.mockResolvedValue(PLANTILLA);

      await service.create(TENANT, {
        nombre: 'Plantilla',
        metadata: { checklist: ['Revisar presión', 'Cambiar filtro'] },
      });

      const args = prisma.plantillaMantenimiento.create.mock.calls[0][0];
      expect(args.data.metadata).toEqual({
        checklist: ['Revisar presión', 'Cambiar filtro'],
      });
    });

    it('400 si metadata.checklist no es un arreglo', async () => {
      await expect(
        service.create(TENANT, {
          nombre: 'Plantilla',
          metadata: { checklist: 'Revisar presión' },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 si metadata.checklist tiene pasos vacíos o no-string', async () => {
      await expect(
        service.create(TENANT, {
          nombre: 'Plantilla',
          metadata: { checklist: ['Revisar presión', '   '] },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.create(TENANT, {
          nombre: 'Plantilla',
          metadata: { checklist: ['Revisar presión', 42] },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('acepta metadata sin checklist', async () => {
      prisma.plantillaMantenimiento.create.mockResolvedValue(PLANTILLA);

      await service.create(TENANT, {
        nombre: 'Plantilla',
        metadata: { nota: 'usar guantes' },
      });

      expect(prisma.plantillaMantenimiento.create).toHaveBeenCalled();
    });
  });

  // ---------- findAll ----------

  describe('findAll', () => {
    it('filtra por tenant + activo por defecto y mapea itemsCount', async () => {
      prisma.plantillaMantenimiento.findMany.mockResolvedValue([
        { ...PLANTILLA, _count: { items: 3 } },
      ]);
      prisma.plantillaMantenimiento.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT, {});

      const args = prisma.plantillaMantenimiento.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ tenantId: TENANT, activo: true });
      expect(result.data[0]).toMatchObject({
        id: PLANTILLA_ID,
        itemsCount: 3,
      });
      expect(result.meta.total).toBe(1);
    });

    it('aplica search, tipoEquipo e includeInactive', async () => {
      prisma.plantillaMantenimiento.findMany.mockResolvedValue([]);
      prisma.plantillaMantenimiento.count.mockResolvedValue(0);

      await service.findAll(TENANT, {
        search: 'compresor',
        tipoEquipo: 'Compresor',
        includeInactive: true,
      });

      const args = prisma.plantillaMantenimiento.findMany.mock.calls[0][0];
      expect(args.where).toEqual({
        tenantId: TENANT,
        tipoEquipo: { equals: 'Compresor', mode: 'insensitive' },
        nombre: { contains: 'compresor', mode: 'insensitive' },
      });
    });
  });

  // ---------- findOne ----------

  describe('findOne', () => {
    it('devuelve la plantilla con items mapeados (stockDisponible)', async () => {
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue({
        ...PLANTILLA,
        items: [ITEM_ROW],
      });

      const result = await service.findOne(TENANT, PLANTILLA_ID);

      const args = prisma.plantillaMantenimiento.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ id: PLANTILLA_ID, tenantId: TENANT });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].repuesto.stockDisponible).toBe(7);
    });

    it('404 si no existe o es de otro tenant', async () => {
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(TENANT, PLANTILLA_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- update ----------

  describe('update', () => {
    it('actualiza campos y permite reactivar con activo: true', async () => {
      mockPlantillaOk();
      prisma.plantillaMantenimiento.update.mockResolvedValue(PLANTILLA);

      await service.update(TENANT, PLANTILLA_ID, {
        nombre: '  Nueva receta  ',
        activo: true,
      });

      const args = prisma.plantillaMantenimiento.update.mock.calls[0][0];
      expect(args.data).toEqual({ nombre: 'Nueva receta', activo: true });
    });

    it('metadata: null limpia la columna completa (DbNull)', async () => {
      mockPlantillaOk();
      prisma.plantillaMantenimiento.update.mockResolvedValue(PLANTILLA);

      await service.update(TENANT, PLANTILLA_ID, { metadata: null });

      const args = prisma.plantillaMantenimiento.update.mock.calls[0][0];
      // Prisma.DbNull (objeto sentinel, no null literal).
      expect(args.data.metadata).not.toBeNull();
      expect(args.data.metadata.constructor.name).toBe('DbNull');
    });

    it('limpia opcionales con string vacío', async () => {
      mockPlantillaOk();
      prisma.plantillaMantenimiento.update.mockResolvedValue(PLANTILLA);

      await service.update(TENANT, PLANTILLA_ID, { descripcion: '' });

      const args = prisma.plantillaMantenimiento.update.mock.calls[0][0];
      expect(args.data).toEqual({ descripcion: null });
    });

    it('404 si la plantilla no existe en el tenant', async () => {
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue(null);
      await expect(
        service.update(TENANT, PLANTILLA_ID, { nombre: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('400 si nombre es solo espacios', async () => {
      mockPlantillaOk();
      await expect(
        service.update(TENANT, PLANTILLA_ID, { nombre: '  ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('400 si metadata.checklist es inválida', async () => {
      mockPlantillaOk();
      await expect(
        service.update(TENANT, PLANTILLA_ID, {
          metadata: { checklist: [{}] },
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ---------- desactivar ----------

  describe('desactivar', () => {
    it('marca activo: false', async () => {
      mockPlantillaOk();
      prisma.plantillaMantenimiento.update.mockResolvedValue({
        ...PLANTILLA,
        activo: false,
      });

      const result = await service.desactivar(TENANT, PLANTILLA_ID);

      const args = prisma.plantillaMantenimiento.update.mock.calls[0][0];
      expect(args.data).toEqual({ activo: false });
      expect(result.activo).toBe(false);
    });

    it('404 si no existe', async () => {
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue(null);
      await expect(
        service.desactivar(TENANT, PLANTILLA_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- addItem ----------

  describe('addItem', () => {
    const REPUESTO_ACTIVO = {
      id: REPUESTO_ID,
      codigo: 'FILTRO-001',
      activo: true,
    };

    it('agrega el insumo validando tenant en plantilla y repuesto', async () => {
      mockPlantillaOk();
      prisma.repuesto.findFirst.mockResolvedValue(REPUESTO_ACTIVO);
      prisma.repuesto.findUniqueOrThrow.mockResolvedValue(REPUESTO_ACTIVO);
      prisma.plantillaMantenimientoItem.findUnique.mockResolvedValue(null);
      prisma.plantillaMantenimientoItem.create.mockResolvedValue(ITEM_ROW);

      const result = await service.addItem(TENANT, PLANTILLA_ID, {
        repuestoId: REPUESTO_ID,
        cantidad: 2,
      });

      expect(
        prisma.plantillaMantenimiento.findFirst.mock.calls[0][0].where,
      ).toEqual({ id: PLANTILLA_ID, tenantId: TENANT });
      expect(prisma.repuesto.findFirst.mock.calls[0][0].where).toEqual({
        id: REPUESTO_ID,
        tenantId: TENANT,
      });

      const createArgs =
        prisma.plantillaMantenimientoItem.create.mock.calls[0][0];
      expect(createArgs.data).toMatchObject({
        tenantId: TENANT,
        plantillaId: PLANTILLA_ID,
        repuestoId: REPUESTO_ID,
        cantidad: 2,
      });
      expect(result.repuesto.stockDisponible).toBe(7);
    });

    it('404 si la plantilla no existe en el tenant', async () => {
      prisma.plantillaMantenimiento.findFirst.mockResolvedValue(null);

      await expect(
        service.addItem(TENANT, PLANTILLA_ID, {
          repuestoId: REPUESTO_ID,
          cantidad: 1,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.plantillaMantenimientoItem.create).not.toHaveBeenCalled();
    });

    it('404 si el repuesto no existe o es de otro tenant', async () => {
      mockPlantillaOk();
      prisma.repuesto.findFirst.mockResolvedValue(null);

      await expect(
        service.addItem(TENANT, PLANTILLA_ID, {
          repuestoId: 'rep-ajeno',
          cantidad: 1,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 si el repuesto está inactivo', async () => {
      mockPlantillaOk();
      prisma.repuesto.findFirst.mockResolvedValue({
        ...REPUESTO_ACTIVO,
        activo: false,
      });

      await expect(
        service.addItem(TENANT, PLANTILLA_ID, {
          repuestoId: REPUESTO_ID,
          cantidad: 1,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('409 si el repuesto ya está en la plantilla', async () => {
      mockPlantillaOk();
      prisma.repuesto.findFirst.mockResolvedValue(REPUESTO_ACTIVO);
      prisma.plantillaMantenimientoItem.findUnique.mockResolvedValue({
        id: ITEM_ID,
      });

      await expect(
        service.addItem(TENANT, PLANTILLA_ID, {
          repuestoId: REPUESTO_ID,
          cantidad: 1,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.plantillaMantenimientoItem.create).not.toHaveBeenCalled();
    });

    it('409 si el repuesto se desactiva durante la transacción (re-check post-create)', async () => {
      mockPlantillaOk();
      prisma.repuesto.findFirst.mockResolvedValue(REPUESTO_ACTIVO);
      prisma.plantillaMantenimientoItem.findUnique.mockResolvedValue(null);
      prisma.plantillaMantenimientoItem.create.mockResolvedValue(ITEM_ROW);
      // Desactivación concurrente commiteada entre el check inicial y el
      // re-check: la tx debe revertir con 409.
      prisma.repuesto.findUniqueOrThrow.mockResolvedValue({
        ...REPUESTO_ACTIVO,
        activo: false,
      });

      await expect(
        service.addItem(TENANT, PLANTILLA_ID, {
          repuestoId: REPUESTO_ID,
          cantidad: 1,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("normaliza observacion: '  ' se persiste como null", async () => {
      mockPlantillaOk();
      prisma.repuesto.findFirst.mockResolvedValue(REPUESTO_ACTIVO);
      prisma.repuesto.findUniqueOrThrow.mockResolvedValue(REPUESTO_ACTIVO);
      prisma.plantillaMantenimientoItem.findUnique.mockResolvedValue(null);
      prisma.plantillaMantenimientoItem.create.mockResolvedValue(ITEM_ROW);

      await service.addItem(TENANT, PLANTILLA_ID, {
        repuestoId: REPUESTO_ID,
        cantidad: 1,
        observacion: '   ',
      });

      const createArgs =
        prisma.plantillaMantenimientoItem.create.mock.calls[0][0];
      expect(createArgs.data.observacion).toBeNull();
    });
  });

  // ---------- updateItem ----------

  describe('updateItem', () => {
    it('actualiza cantidad/obligatorio/observacion del ítem', async () => {
      mockPlantillaOk();
      prisma.plantillaMantenimientoItem.findFirst.mockResolvedValue({
        id: ITEM_ID,
      });
      prisma.plantillaMantenimientoItem.update.mockResolvedValue({
        ...ITEM_ROW,
        cantidad: 5,
        obligatorio: false,
      });

      const result = await service.updateItem(TENANT, PLANTILLA_ID, ITEM_ID, {
        cantidad: 5,
        obligatorio: false,
      });

      const findArgs =
        prisma.plantillaMantenimientoItem.findFirst.mock.calls[0][0];
      expect(findArgs.where).toEqual({
        id: ITEM_ID,
        tenantId: TENANT,
        plantillaId: PLANTILLA_ID,
      });
      const updateArgs =
        prisma.plantillaMantenimientoItem.update.mock.calls[0][0];
      expect(updateArgs.data).toEqual({ cantidad: 5, obligatorio: false });
      expect(result.cantidad).toBe(5);
    });

    it('400 si no se especifica ningún campo', async () => {
      await expect(
        service.updateItem(TENANT, PLANTILLA_ID, ITEM_ID, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.plantillaMantenimiento.findFirst).not.toHaveBeenCalled();
    });

    it('404 si el ítem no existe en la plantilla', async () => {
      mockPlantillaOk();
      prisma.plantillaMantenimientoItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateItem(TENANT, PLANTILLA_ID, ITEM_ID, { cantidad: 3 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- removeItem ----------

  describe('removeItem', () => {
    it('elimina filtrando por tenant + plantilla + ítem', async () => {
      mockPlantillaOk();
      prisma.plantillaMantenimientoItem.deleteMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.removeItem(TENANT, PLANTILLA_ID, ITEM_ID);

      const args =
        prisma.plantillaMantenimientoItem.deleteMany.mock.calls[0][0];
      expect(args.where).toEqual({
        id: ITEM_ID,
        tenantId: TENANT,
        plantillaId: PLANTILLA_ID,
      });
      expect(result.deleted).toBe(true);
    });

    it('404 si el ítem no existe', async () => {
      mockPlantillaOk();
      prisma.plantillaMantenimientoItem.deleteMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.removeItem(TENANT, PLANTILLA_ID, ITEM_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
