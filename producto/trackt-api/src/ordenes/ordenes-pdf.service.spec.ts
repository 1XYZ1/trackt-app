import { NotFoundException } from '@nestjs/common';
import { OrdenesPdfService } from './ordenes-pdf.service';
import { PrismaService } from '../prisma/prisma.service';

function buildPrismaMock() {
  return {
    ordenTrabajo: {
      findFirst: jest.fn(),
    },
    evidencia: {
      findMany: jest.fn(),
    },
    reservaRepuesto: {
      findMany: jest.fn(),
    },
    movimientoInventario: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

const TENANT = 'tenant-1';
const OT_ID = 'ot-1';

const OT_ROW = {
  id: OT_ID,
  codigo: 'OT-2026-0001',
  descripcion: 'Mantención mensual compresor',
  prioridad: 'MEDIA',
  estado: 'EN_PROCESO',
  creadoPorId: '550e8400-e29b-41d4-a716-446655440000',
  fechaCierre: null,
  createdAt: new Date('2026-06-10T10:00:00Z'),
  equipo: {
    codigo: 'EQ-100',
    nombre: 'Compresor principal',
    tipo: 'compresor',
    ubicacion: 'Sala de máquinas',
  },
  tickets: [
    {
      id: 'tkt-1',
      codigo: 'TKT-2026-0001',
      titulo: 'Cambio de filtros',
      estado: 'ASIGNADO',
      prioridad: 'MEDIA',
      mecanicoId: '660e8400-e29b-41d4-a716-446655440000',
    },
  ],
};

describe('OrdenesPdfService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: OrdenesPdfService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new OrdenesPdfService(prisma as unknown as PrismaService);
  });

  function mockDataOk() {
    prisma.ordenTrabajo.findFirst.mockResolvedValue(OT_ROW);
    prisma.evidencia.findMany.mockResolvedValue([
      {
        descripcion: 'Foto del filtro',
        createdAt: new Date(),
        ticket: { codigo: 'TKT-2026-0001' },
      },
    ]);
    prisma.reservaRepuesto.findMany.mockResolvedValue([
      {
        estado: 'RESERVADA',
        observacion: null,
        ticket: { codigo: 'TKT-2026-0001' },
        items: [
          {
            cantidad: 2,
            repuesto: {
              codigo: 'FILTRO-001',
              nombre: 'Filtro de aire',
              unidad: 'unidad',
            },
          },
        ],
      },
    ]);
    prisma.movimientoInventario.findMany.mockResolvedValue([
      {
        cantidad: -2,
        repuesto: {
          codigo: 'FILTRO-001',
          nombre: 'Filtro de aire',
          unidad: 'unidad',
        },
      },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { id: OT_ROW.creadoPorId, full_name: 'Jefa Taller' },
      { id: '660e8400-e29b-41d4-a716-446655440000', full_name: 'Mecánico Uno' },
    ]);
  }

  it('genera un PDF válido con el código de la OT como nombre de archivo', async () => {
    mockDataOk();

    const { buffer, filename } = await service.generarPdf(TENANT, OT_ID);

    expect(filename).toBe('OT-2026-0001.pdf');
    expect(buffer.length).toBeGreaterThan(500);
    // Firma estándar del formato PDF.
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('consulta la OT scoped por tenant y las reservas/consumos por tenant + tickets', async () => {
    mockDataOk();

    await service.generarPdf(TENANT, OT_ID);

    expect(prisma.ordenTrabajo.findFirst.mock.calls[0][0].where).toEqual({
      id: OT_ID,
      tenantId: TENANT,
    });
    expect(
      prisma.reservaRepuesto.findMany.mock.calls[0][0].where,
    ).toMatchObject({
      tenantId: TENANT,
      ticketId: { in: ['tkt-1'] },
    });
    expect(
      prisma.movimientoInventario.findMany.mock.calls[0][0].where,
    ).toMatchObject({
      tenantId: TENANT,
      ticketId: { in: ['tkt-1'] },
    });
  });

  it('404 si la OT no existe o es de otro tenant', async () => {
    prisma.ordenTrabajo.findFirst.mockResolvedValue(null);

    await expect(service.generarPdf(TENANT, OT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('genera PDF también para OT sin tickets ni reservas', async () => {
    prisma.ordenTrabajo.findFirst.mockResolvedValue({
      ...OT_ROW,
      tickets: [],
    });
    prisma.evidencia.findMany.mockResolvedValue([]);
    prisma.reservaRepuesto.findMany.mockResolvedValue([]);
    prisma.movimientoInventario.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);

    const { buffer } = await service.generarPdf(TENANT, OT_ID);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
