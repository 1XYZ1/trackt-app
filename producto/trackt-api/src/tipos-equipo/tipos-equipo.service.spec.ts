import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TiposEquipoService } from './tipos-equipo.service';
import { PrismaService } from '../prisma/prisma.service';

function buildPrismaMock() {
  const mock = {
    tipoEquipo: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tipoEquipoRepuestoDefault: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    repuesto: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    throw new Error('Unexpected $transaction argument');
  });

  return mock;
}

const TENANT = 'tenant-1';
const TIPO_ID = 'tipo-1';

describe('TiposEquipoService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: TiposEquipoService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new TiposEquipoService(prisma as unknown as PrismaService);
  });

  // ---------- create ----------

  describe('create', () => {
    it('crea el tipo normalizando nombre (trim) y descripcion vacía → null', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue(null);
      prisma.tipoEquipo.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: TIPO_ID, activo: true, ...data }),
      );

      const result = await service.create(TENANT, {
        nombre: '  Excavadora  ',
        descripcion: '   ',
      });

      const args = prisma.tipoEquipo.create.mock.calls[0][0];
      expect(args.data).toMatchObject({
        tenantId: TENANT,
        nombre: 'Excavadora',
        descripcion: null,
      });
      expect(result.nombre).toBe('Excavadora');
    });

    it('rechaza nombre de solo espacios (400)', async () => {
      await expect(
        service.create(TENANT, { nombre: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.tipoEquipo.create).not.toHaveBeenCalled();
    });

    it('rechaza duplicado case-insensitive en el tenant (409)', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue({ id: 'otro' });

      await expect(
        service.create(TENANT, { nombre: 'excavadora' }),
      ).rejects.toBeInstanceOf(ConflictException);

      const args = prisma.tipoEquipo.findFirst.mock.calls[0][0];
      expect(args.where).toMatchObject({
        tenantId: TENANT,
        nombre: { equals: 'excavadora', mode: 'insensitive' },
      });
      expect(prisma.tipoEquipo.create).not.toHaveBeenCalled();
    });
  });

  // ---------- update ----------

  describe('update', () => {
    it('actualiza parcial sin dup check si el nombre no cambia', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValueOnce({
        id: TIPO_ID,
        nombre: 'Excavadora',
      });
      prisma.tipoEquipo.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: TIPO_ID, ...data }),
      );

      await service.update(TENANT, TIPO_ID, { activo: true });

      expect(prisma.tipoEquipo.findFirst).toHaveBeenCalledTimes(1);
      const args = prisma.tipoEquipo.update.mock.calls[0][0];
      expect(args.data).toEqual({ activo: true });
    });

    it('descripcion=null limpia el valor', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValueOnce({
        id: TIPO_ID,
        nombre: 'Excavadora',
      });
      prisma.tipoEquipo.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: TIPO_ID, ...data }),
      );

      await service.update(TENANT, TIPO_ID, { descripcion: null });

      const args = prisma.tipoEquipo.update.mock.calls[0][0];
      expect(args.data).toEqual({ descripcion: null });
    });

    it('valida colisión al cambiar nombre (409)', async () => {
      prisma.tipoEquipo.findFirst
        .mockResolvedValueOnce({ id: TIPO_ID, nombre: 'Excavadora' })
        .mockResolvedValueOnce({ id: 'otro' });

      await expect(
        service.update(TENANT, TIPO_ID, { nombre: 'Cargador' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.tipoEquipo.update).not.toHaveBeenCalled();
    });

    it('404 si el tipo no existe en el tenant', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue(null);
      await expect(
        service.update(TENANT, TIPO_ID, { nombre: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- desactivar ----------

  describe('desactivar', () => {
    it('baja lógica: activo=false', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue({ id: TIPO_ID });
      prisma.tipoEquipo.update.mockResolvedValue({
        id: TIPO_ID,
        activo: false,
      });

      const result = await service.desactivar(TENANT, TIPO_ID);

      const args = prisma.tipoEquipo.update.mock.calls[0][0];
      expect(args.data).toEqual({ activo: false });
      expect(result.activo).toBe(false);
    });

    it('404 si no existe en el tenant', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue(null);
      await expect(service.desactivar(TENANT, TIPO_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ---------- findAll ----------

  describe('findAll', () => {
    beforeEach(() => {
      prisma.tipoEquipo.findMany.mockResolvedValue([]);
      prisma.tipoEquipo.count.mockResolvedValue(0);
    });

    it('por defecto solo activos del tenant', async () => {
      await service.findAll(TENANT, { page: 1, limit: 10 });

      const args = prisma.tipoEquipo.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ tenantId: TENANT, activo: true });
    });

    it('includeInactive=true devuelve todos', async () => {
      await service.findAll(TENANT, {
        page: 1,
        limit: 10,
        includeInactive: true,
      });

      const args = prisma.tipoEquipo.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ tenantId: TENANT });
    });

    it('search filtra por nombre case-insensitive', async () => {
      await service.findAll(TENANT, { page: 1, limit: 10, search: 'exc' });

      const args = prisma.tipoEquipo.findMany.mock.calls[0][0];
      expect(args.where.nombre).toEqual({
        contains: 'exc',
        mode: 'insensitive',
      });
    });
  });

  // ---------- findOne ----------

  describe('findOne', () => {
    it('devuelve el tipo con sus repuestos default mapeados (stock disponible)', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue({
        id: TIPO_ID,
        nombre: 'Excavadora',
      });
      prisma.tipoEquipoRepuestoDefault.findMany.mockResolvedValue([
        {
          id: 'def-1',
          tipoEquipoId: TIPO_ID,
          cantidadRef: 2,
          obligatorio: true,
          observacion: 'filtro',
          createdAt: new Date('2025-01-01T00:00:00Z'),
          repuesto: {
            id: 'rep-1',
            codigo: 'R-1',
            nombre: 'Filtro',
            unidad: 'UN',
            activo: true,
            marcaId: null,
            stock: { stockActual: 10, stockReservado: 3 },
          },
        },
      ]);

      const result = await service.findOne(TENANT, TIPO_ID);

      expect(result.nombre).toBe('Excavadora');
      expect(result.repuestos).toHaveLength(1);
      expect(result.repuestos[0]).toMatchObject({
        id: 'def-1',
        tipoEquipoId: TIPO_ID,
        cantidadRef: 2,
        obligatorio: true,
      });
      // stockDisponible = stockActual - stockReservado.
      expect(result.repuestos[0].repuesto.stockDisponible).toBe(7);
    });

    it('404 si el tipo no existe en el tenant', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT, TIPO_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ---------- repuestos default ----------

  describe('addRepuesto', () => {
    it('asocia el repuesto default al tipo (obligatorio solo si vino explícito)', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue({ id: TIPO_ID });
      prisma.repuesto.findFirst.mockResolvedValue({
        id: 'rep-1',
        codigo: 'R-1',
        activo: true,
      });
      prisma.tipoEquipoRepuestoDefault.findUnique.mockResolvedValue(null);
      prisma.tipoEquipoRepuestoDefault.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'def-1',
          createdAt: new Date(),
          ...data,
          repuesto: {
            id: 'rep-1',
            codigo: 'R-1',
            nombre: 'Filtro',
            unidad: 'UN',
            activo: true,
            marcaId: null,
            stock: { stockActual: 5, stockReservado: 1 },
          },
        }),
      );

      const result = await service.addRepuesto(TENANT, TIPO_ID, {
        repuestoId: 'rep-1',
        cantidadRef: 3,
        obligatorio: false,
      });

      const args = prisma.tipoEquipoRepuestoDefault.create.mock.calls[0][0];
      expect(args.data).toMatchObject({
        tenantId: TENANT,
        tipoEquipoId: TIPO_ID,
        repuestoId: 'rep-1',
        cantidadRef: 3,
        obligatorio: false,
      });
      expect(result.repuesto.stockDisponible).toBe(4);
    });

    it('no setea obligatorio si no vino (default BD)', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue({ id: TIPO_ID });
      prisma.repuesto.findFirst.mockResolvedValue({
        id: 'rep-1',
        codigo: 'R-1',
        activo: true,
      });
      prisma.tipoEquipoRepuestoDefault.findUnique.mockResolvedValue(null);
      prisma.tipoEquipoRepuestoDefault.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'def-1',
          createdAt: new Date(),
          obligatorio: true,
          ...data,
          repuesto: {
            id: 'rep-1',
            codigo: 'R-1',
            nombre: 'Filtro',
            unidad: 'UN',
            activo: true,
            marcaId: null,
            stock: null,
          },
        }),
      );

      await service.addRepuesto(TENANT, TIPO_ID, { repuestoId: 'rep-1' });

      const args = prisma.tipoEquipoRepuestoDefault.create.mock.calls[0][0];
      expect(args.data.obligatorio).toBeUndefined();
    });

    it('404 si el tipo no existe', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue(null);
      await expect(
        service.addRepuesto(TENANT, TIPO_ID, { repuestoId: 'rep-1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404 si el repuesto no existe en el tenant', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue({ id: TIPO_ID });
      prisma.repuesto.findFirst.mockResolvedValue(null);
      await expect(
        service.addRepuesto(TENANT, TIPO_ID, { repuestoId: 'rep-x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 si el repuesto está inactivo', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue({ id: TIPO_ID });
      prisma.repuesto.findFirst.mockResolvedValue({
        id: 'rep-1',
        codigo: 'R-1',
        activo: false,
      });
      await expect(
        service.addRepuesto(TENANT, TIPO_ID, { repuestoId: 'rep-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('409 si el repuesto ya es default del tipo', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue({ id: TIPO_ID });
      prisma.repuesto.findFirst.mockResolvedValue({
        id: 'rep-1',
        codigo: 'R-1',
        activo: true,
      });
      prisma.tipoEquipoRepuestoDefault.findUnique.mockResolvedValue({
        id: 'def-1',
      });
      await expect(
        service.addRepuesto(TENANT, TIPO_ID, { repuestoId: 'rep-1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.tipoEquipoRepuestoDefault.create).not.toHaveBeenCalled();
    });
  });

  describe('removeRepuesto', () => {
    it('borra el default y devuelve confirmación', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue({ id: TIPO_ID });
      prisma.tipoEquipoRepuestoDefault.deleteMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.removeRepuesto(TENANT, TIPO_ID, 'rep-1');

      const args = prisma.tipoEquipoRepuestoDefault.deleteMany.mock.calls[0][0];
      expect(args.where).toEqual({
        tenantId: TENANT,
        tipoEquipoId: TIPO_ID,
        repuestoId: 'rep-1',
      });
      expect(result).toEqual({
        deleted: true,
        tipoEquipoId: TIPO_ID,
        repuestoId: 'rep-1',
      });
    });

    it('404 si el default no existía (count=0)', async () => {
      prisma.tipoEquipo.findFirst.mockResolvedValue({ id: TIPO_ID });
      prisma.tipoEquipoRepuestoDefault.deleteMany.mockResolvedValue({
        count: 0,
      });
      await expect(
        service.removeRepuesto(TENANT, TIPO_ID, 'rep-x'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
