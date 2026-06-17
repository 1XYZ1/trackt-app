import { Injectable, NotFoundException } from '@nestjs/common';
import { MovimientoInventarioTipo } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from '../auth/profile.service';

// Datos ya hidratados que consume el armado del documento.
interface OtPdfData {
  ot: {
    codigo: string;
    descripcion: string;
    prioridad: string;
    estado: string;
    createdAt: Date;
    fechaCierre: Date | null;
    creadoPor: string;
  };
  equipo: {
    codigo: string;
    nombre: string;
    tipo: string | null;
    ubicacion: string | null;
  };
  tickets: Array<{
    codigo: string;
    titulo: string;
    estado: string;
    prioridad: string;
    mecanico: string;
  }>;
  reservas: Array<{
    ticketCodigo: string;
    estado: string;
    observacion: string | null;
    items: Array<{
      codigo: string;
      nombre: string;
      unidad: string;
      cantidad: number;
    }>;
  }>;
  consumos: Array<{
    codigo: string;
    nombre: string;
    unidad: string;
    cantidad: number;
  }>;
  evidencias: Array<{
    ticketCodigo: string;
    descripcion: string | null;
    createdAt: Date;
  }>;
}

/**
 * PDF imprimible de una OT (Fase 6). pdfkit: generación en memoria, sin
 * navegador headless — suficiente para una ficha de una o dos páginas.
 * La reserva sigue viviendo en el ticket; acá solo se agrega la vista.
 */
@Injectable()
export class OrdenesPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
  ) {}

  async generarPdf(
    tenantId: string,
    otId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const ot = await this.prisma.ordenTrabajo.findFirst({
      where: { id: otId, tenantId },
      include: {
        equipo: {
          select: { codigo: true, nombre: true, tipo: true, ubicacion: true },
        },
        tickets: {
          select: {
            id: true,
            codigo: true,
            titulo: true,
            estado: true,
            prioridad: true,
            mecanicoId: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ot) {
      throw new NotFoundException(`Orden con id "${otId}" no encontrada`);
    }

    const ticketIds = ot.tickets.map((t) => t.id);
    const [evidencias, reservas, consumos] = await this.prisma.$transaction([
      // Evidencias no tienen tenant_id: scoping por los tickets de la OT.
      this.prisma.evidencia.findMany({
        where: { ticketId: { in: ticketIds } },
        select: {
          descripcion: true,
          createdAt: true,
          ticket: { select: { codigo: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      this.prisma.reservaRepuesto.findMany({
        where: { tenantId, ticketId: { in: ticketIds } },
        select: {
          estado: true,
          observacion: true,
          ticket: { select: { codigo: true } },
          items: {
            select: {
              cantidad: true,
              repuesto: {
                select: { codigo: true, nombre: true, unidad: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      this.prisma.movimientoInventario.findMany({
        where: {
          tenantId,
          tipo: MovimientoInventarioTipo.CONSUMO,
          ticketId: { in: ticketIds },
        },
        select: {
          cantidad: true,
          repuesto: { select: { codigo: true, nombre: true, unidad: true } },
        },
        take: 200,
      }),
    ]);

    // Nombres de usuario: acceso centralizado en ProfileService.
    const userIds = [
      ot.creadoPorId,
      ...ot.tickets.map((t) => t.mecanicoId),
    ].filter((v): v is string => Boolean(v));
    const users = await this.profiles.getUserSummaries(userIds);

    // Consumos agregados por repuesto (CONSUMO registra negativos).
    const consumoPorRepuesto = new Map<
      string,
      { codigo: string; nombre: string; unidad: string; cantidad: number }
    >();
    for (const mov of consumos) {
      const actual = consumoPorRepuesto.get(mov.repuesto.codigo);
      const cantidad = Math.abs(mov.cantidad);
      if (actual) {
        actual.cantidad += cantidad;
      } else {
        consumoPorRepuesto.set(mov.repuesto.codigo, {
          codigo: mov.repuesto.codigo,
          nombre: mov.repuesto.nombre,
          unidad: mov.repuesto.unidad,
          cantidad,
        });
      }
    }

    const data: OtPdfData = {
      ot: {
        codigo: ot.codigo,
        descripcion: ot.descripcion,
        prioridad: ot.prioridad,
        estado: ot.estado,
        createdAt: ot.createdAt,
        fechaCierre: ot.fechaCierre,
        creadoPor: users.get(ot.creadoPorId)?.nombre ?? ot.creadoPorId,
      },
      equipo: {
        codigo: ot.equipo?.codigo ?? '-',
        nombre: ot.equipo?.nombre ?? '-',
        tipo: ot.equipo?.tipo ?? null,
        ubicacion: ot.equipo?.ubicacion ?? null,
      },
      tickets: ot.tickets.map((t) => ({
        codigo: t.codigo,
        titulo: t.titulo,
        estado: t.estado,
        prioridad: t.prioridad,
        mecanico: t.mecanicoId
          ? (users.get(t.mecanicoId)?.nombre ?? t.mecanicoId)
          : 'Sin asignar',
      })),
      reservas: reservas.map((r) => ({
        ticketCodigo: r.ticket.codigo,
        estado: r.estado,
        observacion: r.observacion,
        items: r.items.map((it) => ({
          codigo: it.repuesto.codigo,
          nombre: it.repuesto.nombre,
          unidad: it.repuesto.unidad,
          cantidad: it.cantidad,
        })),
      })),
      consumos: Array.from(consumoPorRepuesto.values()),
      evidencias: evidencias.map((e) => ({
        ticketCodigo: e.ticket.codigo,
        descripcion: e.descripcion,
        createdAt: e.createdAt,
      })),
    };

    const buffer = await this.buildPdf(data);
    return { buffer, filename: `${ot.codigo}.pdf` };
  }

  // ---------- armado del documento ----------

  private buildPdf(data: OtPdfData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fecha = (d: Date | null) =>
        d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '-';

      // Encabezado
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('ORDEN DE TRABAJO', { align: 'center' });
      doc.fontSize(14).text(data.ot.codigo, { align: 'center' }).moveDown(0.5);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Estado: ${data.ot.estado}    Prioridad: ${data.ot.prioridad}`, {
          align: 'center',
        })
        .moveDown();

      this.seccion(doc, 'Equipo');
      this.campo(doc, 'Código', data.equipo.codigo);
      this.campo(doc, 'Nombre', data.equipo.nombre);
      if (data.equipo.tipo) this.campo(doc, 'Tipo', data.equipo.tipo);
      this.campo(doc, 'Ubicación', data.equipo.ubicacion ?? '-');

      this.seccion(doc, 'Detalle');
      this.campo(doc, 'Descripción', data.ot.descripcion);
      this.campo(doc, 'Creada por', data.ot.creadoPor);
      this.campo(doc, 'Fecha creación', fecha(data.ot.createdAt));
      this.campo(doc, 'Fecha cierre', fecha(data.ot.fechaCierre));

      this.seccion(doc, `Tickets (${data.tickets.length})`);
      if (data.tickets.length === 0) {
        doc.fontSize(9).text('Sin tickets asociados.');
      }
      for (const t of data.tickets) {
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(`${t.codigo} — ${t.titulo}`, { continued: false });
        doc
          .font('Helvetica')
          .text(
            `    Estado: ${t.estado}  |  Prioridad: ${t.prioridad}  |  Mecánico: ${t.mecanico}`,
          )
          .moveDown(0.3);
      }

      this.seccion(
        doc,
        `Repuestos reservados (${data.reservas.length} reserva(s))`,
      );
      if (data.reservas.length === 0) {
        doc.fontSize(9).text('Sin reservas de repuestos.');
      }
      for (const r of data.reservas) {
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .text(`Ticket ${r.ticketCodigo} — reserva ${r.estado}`);
        doc.font('Helvetica');
        for (const it of r.items) {
          doc.text(
            `    ${it.codigo}  ${it.nombre}  —  ${it.cantidad} ${it.unidad}`,
          );
        }
        if (r.observacion) doc.text(`    Obs: ${r.observacion}`);
        doc.moveDown(0.3);
      }

      this.seccion(doc, 'Repuestos consumidos');
      if (data.consumos.length === 0) {
        doc.fontSize(9).text('Sin consumos registrados.');
      }
      for (const c of data.consumos) {
        doc
          .fontSize(9)
          .text(`${c.codigo}  ${c.nombre}  —  ${c.cantidad} ${c.unidad}`);
      }

      this.seccion(doc, `Evidencias (${data.evidencias.length})`);
      if (data.evidencias.length === 0) {
        doc.fontSize(9).text('Sin evidencias registradas.');
      }
      for (const e of data.evidencias) {
        doc
          .fontSize(9)
          .text(
            `${fecha(e.createdAt)}  [${e.ticketCodigo}]  ${e.descripcion ?? 'Sin descripción'}`,
          );
      }

      this.seccion(doc, 'Observaciones');
      doc.fontSize(9);
      for (let i = 0; i < 3; i++) {
        doc.moveDown(0.8);
        doc
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .stroke();
      }

      // Firmas
      doc.moveDown(3);
      const mitad =
        (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2;
      const yFirma = doc.y;
      doc
        .moveTo(doc.page.margins.left + 20, yFirma)
        .lineTo(doc.page.margins.left + mitad - 40, yFirma)
        .stroke();
      doc
        .moveTo(doc.page.margins.left + mitad + 40, yFirma)
        .lineTo(doc.page.width - doc.page.margins.right - 20, yFirma)
        .stroke();
      doc
        .fontSize(9)
        .text(
          'Responsable mantención',
          doc.page.margins.left + 20,
          yFirma + 5,
          {
            width: mitad - 60,
            align: 'center',
          },
        );
      doc.text(
        'Supervisor / Jefe de taller',
        doc.page.margins.left + mitad + 40,
        yFirma + 5,
        { width: mitad - 60, align: 'center' },
      );

      doc.end();
    });
  }

  private seccion(doc: PDFKit.PDFDocument, titulo: string): void {
    doc.moveDown(0.8);
    doc.fontSize(11).font('Helvetica-Bold').text(titulo);
    doc
      .moveTo(doc.page.margins.left, doc.y + 2)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
      .stroke();
    doc.moveDown(0.4);
    doc.font('Helvetica');
  }

  private campo(doc: PDFKit.PDFDocument, label: string, valor: string): void {
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .text(`${label}: `, { continued: true })
      .font('Helvetica')
      .text(valor);
  }
}
