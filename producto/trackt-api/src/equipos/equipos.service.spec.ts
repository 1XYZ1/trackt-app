import { ConflictException, NotFoundException } from '@nestjs/common';
import { EquiposService } from './equipos.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Mock del PrismaService.
 * `$transaction` solo se usa con array en EquiposService.findAll.
 */
function buildPrismaMock() {
  const mock = {
    equipo: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
const EQUIPO_ID = 'eq-1';

describe('EquiposService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: EquiposService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new EquiposService(prisma as unknown as PrismaService);
  });

  // ---------- create ----------

  describe('create', () => {
    it('crea equipo sin metadata y default activo=true (default BD)', async () => {
      prisma.equipo.findUnique.mockResolvedValue(null);
      prisma.equipo.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: EQUIPO_ID, activo: true, ...data }),
      );

      const result = await service.create(TENANT, {
        codigo: 'EQ-100',
        nombre: 'Excavadora',
        marca: 'CAT',
        modelo: 'M320',
        ubicacion: 'Mina 1',
      });

      const args = prisma.equipo.create.mock.calls[0][0];
      expect(args.data.tenantId).toBe(TENANT);
      expect(args.data.codigo).toBe('EQ-100');
      expect(args.data.nombre).toBe('Excavadora');
      // No se setea activo manualmente: lo cubre el default de la BD.
      expect(args.data.activo).toBeUndefined();
      expect(result.activo).toBe(true);
    });

    it('rechaza con ConflictException si el codigo ya existe en el tenant', async () => {
      prisma.equipo.findUnique.mockResolvedValue({ id: 'otro' });

      await expect(
        service.create(TENANT, { codigo: 'EQ-100', nombre: 'X' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.equipo.create).not.toHaveBeenCalled();
    });
  });

  // ---------- update ----------

  describe('update', () => {
    it('permite actualización parcial sin tocar codigo', async () => {
      prisma.equipo.findFirst.mockResolvedValue({
        id: EQUIPO_ID,
        codigo: 'EQ-100',
      });
      prisma.equipo.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: EQUIPO_ID, ...data }),
      );

      await service.update(TENANT, EQUIPO_ID, { nombre: 'Nuevo nombre' });

      const args = prisma.equipo.update.mock.calls[0][0];
      expect(args.data).toEqual({ nombre: 'Nuevo nombre' });
      // No debe consultar findUnique si no cambia el codigo
      expect(prisma.equipo.findUnique).not.toHaveBeenCalled();
    });

    it('permite cambiar codigo si no choca con otro equipo del mismo tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue({
        id: EQUIPO_ID,
        codigo: 'EQ-100',
      });
      prisma.equipo.findUnique.mockResolvedValue(null);
      prisma.equipo.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: EQUIPO_ID, ...data }),
      );

      await service.update(TENANT, EQUIPO_ID, { codigo: 'EQ-200' });

      const args = prisma.equipo.update.mock.calls[0][0];
      expect(args.data.codigo).toBe('EQ-200');
    });

    it('impide duplicar codigo dentro del tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue({
        id: EQUIPO_ID,
        codigo: 'EQ-100',
      });
      prisma.equipo.findUnique.mockResolvedValue({ id: 'otro' });

      await expect(
        service.update(TENANT, EQUIPO_ID, { codigo: 'EQ-200' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.equipo.update).not.toHaveBeenCalled();
    });

    it('falla con NotFoundException si el equipo no existe en el tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT, EQUIPO_ID, { nombre: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- desactivar ----------

  describe('desactivar', () => {
    it('setea activo=false (baja lógica, no hard delete)', async () => {
      prisma.equipo.findFirst.mockResolvedValue({ id: EQUIPO_ID });
      prisma.equipo.update.mockResolvedValue({ id: EQUIPO_ID, activo: false });

      const result = await service.desactivar(TENANT, EQUIPO_ID);

      const args = prisma.equipo.update.mock.calls[0][0];
      expect(args.data).toEqual({ activo: false });
      expect(result.activo).toBe(false);
    });

    it('falla con NotFoundException si el equipo no existe en el tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);
      await expect(
        service.desactivar(TENANT, EQUIPO_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- findAll ----------

  describe('findAll', () => {
    it('por defecto filtra solo equipos activos', async () => {
      prisma.equipo.findMany.mockResolvedValue([]);
      prisma.equipo.count.mockResolvedValue(0);

      await service.findAll(TENANT, { page: 1, limit: 10 });

      const args = prisma.equipo.findMany.mock.calls[0][0];
      expect(args.where).toMatchObject({ tenantId: TENANT, activo: true });
    });

    it('incluye inactivos cuando includeInactive=true', async () => {
      prisma.equipo.findMany.mockResolvedValue([]);
      prisma.equipo.count.mockResolvedValue(0);

      await service.findAll(TENANT, {
        page: 1,
        limit: 10,
        includeInactive: true,
      });

      const args = prisma.equipo.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ tenantId: TENANT });
      expect(args.where.activo).toBeUndefined();
    });

    it('aplica filtro de búsqueda OR sobre múltiples campos', async () => {
      prisma.equipo.findMany.mockResolvedValue([]);
      prisma.equipo.count.mockResolvedValue(0);

      await service.findAll(TENANT, {
        page: 1,
        limit: 10,
        search: 'cat',
      });

      const args = prisma.equipo.findMany.mock.calls[0][0];
      expect(args.where.OR).toEqual([
        { codigo: { contains: 'cat', mode: 'insensitive' } },
        { nombre: { contains: 'cat', mode: 'insensitive' } },
        { marca: { contains: 'cat', mode: 'insensitive' } },
        { modelo: { contains: 'cat', mode: 'insensitive' } },
        { ubicacion: { contains: 'cat', mode: 'insensitive' } },
      ]);
    });
  });

  // ---------- findOne ----------

  describe('findOne', () => {
    it('devuelve el detalle filtrando por tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue({
        id: EQUIPO_ID,
        codigo: 'EQ-100',
      });

      const result = await service.findOne(TENANT, EQUIPO_ID);

      const args = prisma.equipo.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ id: EQUIPO_ID, tenantId: TENANT });
      expect(result.id).toBe(EQUIPO_ID);
    });

    it('falla con NotFoundException si no existe', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT, EQUIPO_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
