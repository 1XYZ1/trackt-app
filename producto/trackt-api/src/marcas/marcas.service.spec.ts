import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { MarcaTipo } from '@prisma/client';
import { MarcasService } from './marcas.service';
import { PrismaService } from '../prisma/prisma.service';

function buildPrismaMock() {
  const mock = {
    marca: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    repuesto: {
      count: jest.fn(),
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
const MARCA_ID = 'marca-1';

describe('MarcasService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: MarcasService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new MarcasService(prisma as unknown as PrismaService);
  });

  // ---------- create ----------

  describe('create', () => {
    it('crea la marca normalizando el nombre (trim)', async () => {
      prisma.marca.findFirst.mockResolvedValue(null);
      prisma.marca.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: MARCA_ID, activo: true, ...data }),
      );

      const result = await service.create(TENANT, {
        nombre: '  Caterpillar  ',
        tipo: MarcaTipo.EQUIPO,
      });

      const args = prisma.marca.create.mock.calls[0][0];
      expect(args.data).toMatchObject({
        tenantId: TENANT,
        nombre: 'Caterpillar',
        tipo: MarcaTipo.EQUIPO,
      });
      expect(result.nombre).toBe('Caterpillar');
    });

    it('rechaza nombre de solo espacios (400)', async () => {
      await expect(
        service.create(TENANT, { nombre: '   ', tipo: MarcaTipo.EQUIPO }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.marca.create).not.toHaveBeenCalled();
    });

    it('rechaza duplicado case-insensitive en el mismo ámbito (409)', async () => {
      prisma.marca.findFirst.mockResolvedValue({ id: 'otra' });

      await expect(
        service.create(TENANT, { nombre: 'caterpillar', tipo: MarcaTipo.EQUIPO }),
      ).rejects.toBeInstanceOf(ConflictException);

      const args = prisma.marca.findFirst.mock.calls[0][0];
      expect(args.where).toMatchObject({
        tenantId: TENANT,
        // El ámbito EQUIPO también choca con AMBOS (findAll los lista juntos).
        tipo: { in: [MarcaTipo.EQUIPO, MarcaTipo.AMBOS] },
        nombre: { equals: 'caterpillar', mode: 'insensitive' },
      });
      expect(prisma.marca.create).not.toHaveBeenCalled();
    });

    it('permite el mismo nombre en ámbito distinto', async () => {
      // El dup check filtra por ámbito (tipo + AMBOS): no encuentra
      // colisión en REPUESTO si solo existe en EQUIPO.
      prisma.marca.findFirst.mockResolvedValue(null);
      prisma.marca.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: MARCA_ID, ...data }),
      );

      await service.create(TENANT, {
        nombre: 'Caterpillar',
        tipo: MarcaTipo.REPUESTO,
      });

      const dupArgs = prisma.marca.findFirst.mock.calls[0][0];
      expect(dupArgs.where.tipo).toEqual({
        in: [MarcaTipo.REPUESTO, MarcaTipo.AMBOS],
      });
      expect(prisma.marca.create).toHaveBeenCalledTimes(1);
    });

    it('rechaza crear AMBOS si el nombre existe en cualquier ámbito (409)', async () => {
      // AMBOS se solapa con todo: el dup check no filtra por tipo.
      prisma.marca.findFirst.mockResolvedValue({ id: 'otra' });

      await expect(
        service.create(TENANT, {
          nombre: 'Caterpillar',
          tipo: MarcaTipo.AMBOS,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      const dupArgs = prisma.marca.findFirst.mock.calls[0][0];
      expect(dupArgs.where.tipo).toBeUndefined();
      expect(prisma.marca.create).not.toHaveBeenCalled();
    });
  });

  // ---------- update ----------

  describe('update', () => {
    it('actualiza parcial sin dup check si nombre/tipo no cambian', async () => {
      prisma.marca.findFirst.mockResolvedValueOnce({
        id: MARCA_ID,
        nombre: 'Bosch',
        tipo: MarcaTipo.REPUESTO,
      });
      prisma.marca.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: MARCA_ID, ...data }),
      );

      await service.update(TENANT, MARCA_ID, { activo: true });

      // findFirst solo se llamó para cargar la marca (no hubo dup check).
      expect(prisma.marca.findFirst).toHaveBeenCalledTimes(1);
      const args = prisma.marca.update.mock.calls[0][0];
      expect(args.data).toEqual({ activo: true });
    });

    it('valida colisión al cambiar nombre (409)', async () => {
      prisma.marca.findFirst
        .mockResolvedValueOnce({
          id: MARCA_ID,
          nombre: 'Bosch',
          tipo: MarcaTipo.REPUESTO,
        })
        .mockResolvedValueOnce({ id: 'otra' }); // dup check encuentra otra

      await expect(
        service.update(TENANT, MARCA_ID, { nombre: 'SKF' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.marca.update).not.toHaveBeenCalled();
    });

    it('el dup check excluye a la propia marca', async () => {
      prisma.marca.findFirst
        .mockResolvedValueOnce({
          id: MARCA_ID,
          nombre: 'Bosch',
          tipo: MarcaTipo.REPUESTO,
        })
        .mockResolvedValueOnce(null);
      prisma.marca.update.mockResolvedValue({ id: MARCA_ID });

      await service.update(TENANT, MARCA_ID, { nombre: 'BOSCH' });

      const dupArgs = prisma.marca.findFirst.mock.calls[1][0];
      expect(dupArgs.where.id).toEqual({ not: MARCA_ID });
    });

    it('404 si la marca no existe en el tenant', async () => {
      prisma.marca.findFirst.mockResolvedValue(null);
      await expect(
        service.update(TENANT, MARCA_ID, { nombre: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409 al cambiar a ámbito EQUIPO con repuestos vinculados', async () => {
      prisma.marca.findFirst
        .mockResolvedValueOnce({
          id: MARCA_ID,
          nombre: 'Bosch',
          tipo: MarcaTipo.AMBOS,
        })
        .mockResolvedValueOnce(null); // dup check sin colisión
      prisma.repuesto.count.mockResolvedValue(2);

      await expect(
        service.update(TENANT, MARCA_ID, { tipo: MarcaTipo.EQUIPO }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.repuesto.count.mock.calls[0][0].where).toEqual({
        tenantId: TENANT,
        marcaId: MARCA_ID,
      });
      expect(prisma.marca.update).not.toHaveBeenCalled();
    });

    it('permite cambiar a EQUIPO si no hay repuestos vinculados', async () => {
      prisma.marca.findFirst
        .mockResolvedValueOnce({
          id: MARCA_ID,
          nombre: 'Bosch',
          tipo: MarcaTipo.REPUESTO,
        })
        .mockResolvedValueOnce(null);
      prisma.repuesto.count.mockResolvedValue(0);
      prisma.marca.update.mockResolvedValue({
        id: MARCA_ID,
        tipo: MarcaTipo.EQUIPO,
      });

      await service.update(TENANT, MARCA_ID, { tipo: MarcaTipo.EQUIPO });

      expect(prisma.marca.update).toHaveBeenCalledTimes(1);
    });
  });

  // ---------- desactivar ----------

  describe('desactivar', () => {
    it('baja lógica: activo=false', async () => {
      prisma.marca.findFirst.mockResolvedValue({ id: MARCA_ID });
      prisma.marca.update.mockResolvedValue({ id: MARCA_ID, activo: false });

      const result = await service.desactivar(TENANT, MARCA_ID);

      const args = prisma.marca.update.mock.calls[0][0];
      expect(args.data).toEqual({ activo: false });
      expect(result.activo).toBe(false);
    });

    it('404 si no existe en el tenant', async () => {
      prisma.marca.findFirst.mockResolvedValue(null);
      await expect(
        service.desactivar(TENANT, MARCA_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- findAll ----------

  describe('findAll', () => {
    beforeEach(() => {
      prisma.marca.findMany.mockResolvedValue([]);
      prisma.marca.count.mockResolvedValue(0);
    });

    it('por defecto solo activas del tenant', async () => {
      await service.findAll(TENANT, { page: 1, limit: 10 });

      const args = prisma.marca.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ tenantId: TENANT, activo: true });
    });

    it('tipo=REPUESTO incluye también las AMBOS (ámbito)', async () => {
      await service.findAll(TENANT, {
        page: 1,
        limit: 10,
        tipo: MarcaTipo.REPUESTO,
      });

      const args = prisma.marca.findMany.mock.calls[0][0];
      expect(args.where.tipo).toEqual({
        in: [MarcaTipo.REPUESTO, MarcaTipo.AMBOS],
      });
    });

    it('search filtra por nombre case-insensitive', async () => {
      await service.findAll(TENANT, { page: 1, limit: 10, search: 'cat' });

      const args = prisma.marca.findMany.mock.calls[0][0];
      expect(args.where.nombre).toEqual({
        contains: 'cat',
        mode: 'insensitive',
      });
    });
  });
});
