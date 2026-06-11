import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EquipoEstadoOperativo } from '@prisma/client';
import { EquiposService } from './equipos.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Mock del PrismaService.
 * `$transaction` se usa con array en findAll y resumen → Promise.all.
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
    ordenTrabajo: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    ticket: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    reservaRepuesto: {
      count: jest.fn(),
    },
    movimientoInventario: {
      aggregate: jest.fn(),
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

    it('normaliza codigo (trim+upper) y trims en el resto de campos', async () => {
      prisma.equipo.findUnique.mockResolvedValue(null);
      prisma.equipo.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: EQUIPO_ID, ...data }),
      );

      await service.create(TENANT, {
        codigo: '  eq-100 ',
        nombre: '  Excavadora  ',
        tipo: ' Pesado ',
        marca: ' CAT ',
        numeroSerie: ' SN-9 ',
        ubicacion: '   ', // solo espacios → null (no guardar "")
      });

      // El check de duplicado también usa el código normalizado.
      const dupArgs = prisma.equipo.findUnique.mock.calls[0][0];
      expect(dupArgs.where.tenantId_codigo.codigo).toBe('EQ-100');

      const args = prisma.equipo.create.mock.calls[0][0];
      expect(args.data.codigo).toBe('EQ-100');
      expect(args.data.nombre).toBe('Excavadora');
      expect(args.data.tipo).toBe('Pesado');
      expect(args.data.marca).toBe('CAT');
      expect(args.data.numeroSerie).toBe('SN-9');
      expect(args.data.ubicacion).toBeNull();
    });

    it('persiste campos de ficha: estadoOperativo y fechas', async () => {
      prisma.equipo.findUnique.mockResolvedValue(null);
      prisma.equipo.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: EQUIPO_ID, ...data }),
      );

      const fechaCompra = new Date('2025-03-01T00:00:00Z');
      await service.create(TENANT, {
        codigo: 'EQ-100',
        nombre: 'Excavadora',
        estadoOperativo: EquipoEstadoOperativo.EN_MANTENIMIENTO,
        fechaCompra,
      });

      const args = prisma.equipo.create.mock.calls[0][0];
      expect(args.data.estadoOperativo).toBe(
        EquipoEstadoOperativo.EN_MANTENIMIENTO,
      );
      expect(args.data.fechaCompra).toBe(fechaCompra);
    });

    it('rechaza con BadRequest si codigo o nombre son solo espacios', async () => {
      await expect(
        service.create(TENANT, { codigo: '   ', nombre: 'X' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create(TENANT, { codigo: 'EQ-1', nombre: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.equipo.create).not.toHaveBeenCalled();
    });

    it('rechaza con ConflictException si el codigo ya existe en el tenant', async () => {
      prisma.equipo.findUnique.mockResolvedValue({ id: 'otro' });

      await expect(
        service.create(TENANT, { codigo: 'EQ-100', nombre: 'X' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.equipo.create).not.toHaveBeenCalled();
    });

    it('detecta duplicado aunque difiera en mayúsculas/espacios', async () => {
      prisma.equipo.findUnique.mockResolvedValue({ id: 'otro' });

      await expect(
        service.create(TENANT, { codigo: ' eq-100 ', nombre: 'X' }),
      ).rejects.toBeInstanceOf(ConflictException);
      const dupArgs = prisma.equipo.findUnique.mock.calls[0][0];
      expect(dupArgs.where.tenantId_codigo).toEqual({
        tenantId: TENANT,
        codigo: 'EQ-100',
      });
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

    it('no dispara check de duplicado si el codigo normalizado es el mismo', async () => {
      prisma.equipo.findFirst.mockResolvedValue({
        id: EQUIPO_ID,
        codigo: 'EQ-100',
      });
      prisma.equipo.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: EQUIPO_ID, ...data }),
      );

      await service.update(TENANT, EQUIPO_ID, { codigo: ' eq-100 ' });

      expect(prisma.equipo.findUnique).not.toHaveBeenCalled();
      const args = prisma.equipo.update.mock.calls[0][0];
      expect(args.data.codigo).toBe('EQ-100');
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

    it('normaliza textos y permite limpiar campos con null', async () => {
      prisma.equipo.findFirst.mockResolvedValue({
        id: EQUIPO_ID,
        codigo: 'EQ-100',
      });
      prisma.equipo.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: EQUIPO_ID, ...data }),
      );

      await service.update(TENANT, EQUIPO_ID, {
        marca: ' CAT ',
        modelo: null, // limpiar
        ubicacion: '  ', // solo espacios → null
        estadoOperativo: EquipoEstadoOperativo.FUERA_DE_SERVICIO,
      });

      const args = prisma.equipo.update.mock.calls[0][0];
      expect(args.data).toEqual({
        marca: 'CAT',
        modelo: null,
        ubicacion: null,
        estadoOperativo: EquipoEstadoOperativo.FUERA_DE_SERVICIO,
      });
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

    it('aplica filtro de búsqueda OR sobre múltiples campos (incl. tipo y numeroSerie)', async () => {
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
        { tipo: { contains: 'cat', mode: 'insensitive' } },
        { marca: { contains: 'cat', mode: 'insensitive' } },
        { modelo: { contains: 'cat', mode: 'insensitive' } },
        { numeroSerie: { contains: 'cat', mode: 'insensitive' } },
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

    it('no expone equipos de otro tenant (mismo 404 que id inexistente)', async () => {
      // El where siempre lleva tenantId: un id válido de otro tenant devuelve null.
      prisma.equipo.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('tenant-2', EQUIPO_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      const args = prisma.equipo.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ id: EQUIPO_ID, tenantId: 'tenant-2' });
    });
  });

  // ---------- QR ----------

  describe('generarQr', () => {
    it('genera un token y lo persiste en el equipo (scoped por tenant)', async () => {
      prisma.equipo.findFirst.mockResolvedValue({ id: EQUIPO_ID });
      prisma.equipo.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: EQUIPO_ID, qrToken: data.qrToken }),
      );

      const result = await service.generarQr(TENANT, EQUIPO_ID);

      const findArgs = prisma.equipo.findFirst.mock.calls[0][0];
      expect(findArgs.where).toEqual({ id: EQUIPO_ID, tenantId: TENANT });

      const args = prisma.equipo.update.mock.calls[0][0];
      expect(typeof args.data.qrToken).toBe('string');
      expect(args.data.qrToken.length).toBeGreaterThan(0);
      expect(result.qrToken).toBe(args.data.qrToken);
    });

    it('regenerar produce un token distinto (invalida el anterior)', async () => {
      prisma.equipo.findFirst.mockResolvedValue({ id: EQUIPO_ID });
      prisma.equipo.update.mockImplementation(({ data }) =>
        Promise.resolve({ id: EQUIPO_ID, qrToken: data.qrToken }),
      );

      await service.generarQr(TENANT, EQUIPO_ID);
      await service.generarQr(TENANT, EQUIPO_ID);

      const token1 = prisma.equipo.update.mock.calls[0][0].data.qrToken;
      const token2 = prisma.equipo.update.mock.calls[1][0].data.qrToken;
      expect(token1).not.toBe(token2);
    });

    it('falla con NotFoundException si el equipo no existe en el tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);
      await expect(service.generarQr(TENANT, EQUIPO_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.equipo.update).not.toHaveBeenCalled();
    });
  });

  describe('findByQrToken', () => {
    it('resuelve el equipo por token dentro del tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue({
        id: EQUIPO_ID,
        qrToken: 'tok-1',
      });

      const result = await service.findByQrToken(TENANT, 'tok-1');

      const args = prisma.equipo.findFirst.mock.calls[0][0];
      expect(args.where).toEqual({ qrToken: 'tok-1', tenantId: TENANT });
      expect(result.id).toBe(EQUIPO_ID);
    });

    it('404 si el token es de otro tenant o no existe', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);
      await expect(
        service.findByQrToken(TENANT, 'tok-ajeno'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------- resumen ----------

  describe('resumen', () => {
    function mockResumenData(opts?: {
      equipo?: Partial<Record<string, unknown>>;
      otsAlta?: number;
    }) {
      prisma.equipo.findFirst.mockResolvedValue({
        id: EQUIPO_ID,
        codigo: 'EQ-100',
        nombre: 'Excavadora',
        activo: true,
        estadoOperativo: EquipoEstadoOperativo.OPERATIVO,
        ...opts?.equipo,
      });
      // Orden de llamadas a ordenTrabajo.count: abiertas, cerradas, prioridad ALTA.
      prisma.ordenTrabajo.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(opts?.otsAlta ?? 0);
      // Orden: activos, cerrados.
      prisma.ticket.count.mockResolvedValueOnce(3).mockResolvedValueOnce(7);
      prisma.reservaRepuesto.count.mockResolvedValue(1);
      prisma.movimientoInventario.aggregate.mockResolvedValue({
        _sum: { cantidad: -12 },
      });
      prisma.ordenTrabajo.findMany.mockResolvedValue([{ id: 'ot-1' }]);
      prisma.ticket.findMany.mockResolvedValue([{ id: 'tkt-1' }]);
    }

    it('devuelve la ficha con estadísticas y consumos en valor absoluto', async () => {
      mockResumenData();

      const result = await service.resumen(TENANT, EQUIPO_ID);

      expect(result.estadisticas).toEqual({
        ordenesAbiertas: 2,
        ordenesCerradas: 5,
        ticketsActivos: 3,
        ticketsCerrados: 7,
        reservasActivas: 1,
        repuestosConsumidos: 12, // CONSUMO se registra negativo → abs
      });
      expect(result.ultimasOrdenes).toEqual([{ id: 'ot-1' }]);
      expect(result.ultimosTickets).toEqual([{ id: 'tkt-1' }]);
      expect(result.proximasProgramaciones).toEqual([]); // Fase 4
      expect(result.alertas).toEqual([]);
    });

    it('todas las consultas van scoped por tenant y equipo', async () => {
      mockResumenData();

      await service.resumen(TENANT, EQUIPO_ID);

      for (const call of prisma.ordenTrabajo.count.mock.calls) {
        expect(call[0].where).toMatchObject({
          tenantId: TENANT,
          equipoId: EQUIPO_ID,
        });
      }
      for (const call of prisma.ticket.count.mock.calls) {
        expect(call[0].where).toMatchObject({
          tenantId: TENANT,
          ot: { equipoId: EQUIPO_ID },
        });
      }
      const reservaCall = prisma.reservaRepuesto.count.mock.calls[0][0];
      expect(reservaCall.where).toMatchObject({
        tenantId: TENANT,
        ticket: { ot: { equipoId: EQUIPO_ID } },
      });
    });

    it('emite alertas por equipo inactivo, fuera de servicio y OTs ALTA abiertas', async () => {
      mockResumenData({
        equipo: {
          activo: false,
          estadoOperativo: EquipoEstadoOperativo.FUERA_DE_SERVICIO,
        },
        otsAlta: 2,
      });

      const result = await service.resumen(TENANT, EQUIPO_ID);

      const tipos = result.alertas.map((a) => a.tipo);
      expect(tipos).toContain('EQUIPO_INACTIVO');
      expect(tipos).toContain('FUERA_DE_SERVICIO');
      expect(tipos).toContain('OT_PRIORIDAD_ALTA');
    });

    it('falla con NotFoundException si el equipo no existe en el tenant', async () => {
      prisma.equipo.findFirst.mockResolvedValue(null);
      await expect(service.resumen(TENANT, EQUIPO_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
