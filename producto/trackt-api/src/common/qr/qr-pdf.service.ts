import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

export interface QrPdfInput {
  /** Nombre del tenant, para personalizar el encabezado del documento. */
  tenantNombre: string;
  /** Título de la ficha (ej. "Código QR del equipo"). */
  titulo: string;
  /** Código de negocio del recurso (destacado bajo el QR). */
  codigo: string;
  /** Nombre legible del recurso. */
  nombre: string;
  /** URL absoluta que codifica el QR (la misma que arma el frontend). */
  url: string;
}

// Paleta de marca Trackt (indigo-violeta).
const VIOLETA = '#6366F1';
const VIOLETA_OSCURO = '#4338CA';
const GRIS = '#6B7280';
const GRIS_CLARO = '#9CA3AF';
const NEGRO = '#111827';

/**
 * Genera un PDF A4 imprimible con el código QR de un recurso (equipo o
 * repuesto), personalizado con el nombre del tenant y el estilo de marca
 * Trackt. Builder puro: recibe los datos ya resueltos y devuelve el Buffer
 * (mismo patrón Promise+chunks que OrdenesPdfService). El QR se rasteriza con
 * `qrcode` porque pdfkit no lo dibuja por sí solo.
 */
@Injectable()
export class QrPdfService {
  async buildQrPdf(input: QrPdfInput): Promise<Buffer> {
    // QR rasterizado a PNG (alta resolución para que imprima nítido).
    const qrPng = await QRCode.toBuffer(input.url, { width: 600, margin: 1 });
    return this.render(input, qrPng);
  }

  private render(input: QrPdfInput, qrPng: Buffer): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;
      const ancho = right - left;
      const centroX = doc.page.width / 2;

      // ----- Banda de encabezado de marca -----
      const bandaAlto = 70;
      doc.rect(0, 0, doc.page.width, bandaAlto).fill(VIOLETA);
      doc
        .fillColor('#FFFFFF')
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('Trackt', left, 22, { width: ancho });
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#E0E7FF')
        .text(input.tenantNombre, left, 48, { width: ancho });

      // ----- Título de la ficha -----
      doc.fillColor(VIOLETA_OSCURO);
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(input.titulo, left, bandaAlto + 28, {
          width: ancho,
          align: 'center',
        });

      // Línea de acento bajo el título.
      const yLinea = doc.y + 6;
      doc
        .moveTo(centroX - 60, yLinea)
        .lineTo(centroX + 60, yLinea)
        .lineWidth(2)
        .stroke(VIOLETA);

      // ----- QR centrado dentro de un marco -----
      const qrSize = 260;
      const marco = qrSize + 36;
      const marcoX = centroX - marco / 2;
      const marcoY = yLinea + 30;
      doc
        .lineWidth(1)
        .roundedRect(marcoX, marcoY, marco, marco, 12)
        .fillAndStroke('#FFFFFF', VIOLETA);
      const qrX = centroX - qrSize / 2;
      const qrY = marcoY + 18;
      doc.image(qrPng, qrX, qrY, { fit: [qrSize, qrSize] });

      // ----- Código y nombre del recurso -----
      let yTexto = marcoY + marco + 26;
      doc
        .fillColor(NEGRO)
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(input.codigo, left, yTexto, { width: ancho, align: 'center' });
      yTexto = doc.y + 2;
      doc
        .fillColor(GRIS)
        .fontSize(12)
        .font('Helvetica')
        .text(input.nombre, left, yTexto, { width: ancho, align: 'center' });

      // ----- Instrucción + URL -----
      doc.moveDown(1.2);
      doc
        .fillColor(GRIS)
        .fontSize(10)
        .font('Helvetica')
        .text('Escanéalo para abrir la ficha', left, doc.y, {
          width: ancho,
          align: 'center',
        });
      doc.moveDown(0.2);
      doc
        .fillColor(GRIS_CLARO)
        .fontSize(8)
        .text(input.url, left, doc.y, { width: ancho, align: 'center' });

      // ----- Footer discreto -----
      const yFooter = doc.page.height - doc.page.margins.bottom - 14;
      doc
        .moveTo(left, yFooter)
        .lineTo(right, yFooter)
        .lineWidth(0.5)
        .stroke(VIOLETA);
      doc
        .fillColor(GRIS_CLARO)
        .fontSize(8)
        .font('Helvetica')
        .text(
          `Generado por Trackt · ${input.tenantNombre}`,
          left,
          yFooter + 4,
          { width: ancho, align: 'center' },
        );

      doc.end();
    });
  }
}
