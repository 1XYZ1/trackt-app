import { Module } from '@nestjs/common';
import { QrPdfService } from './qr-pdf.service';

/**
 * Provee el generador de PDFs de código QR (equipos y repuestos). Lo importan
 * EquiposModule e InventarioModule.
 */
@Module({
  providers: [QrPdfService],
  exports: [QrPdfService],
})
export class QrModule {}
