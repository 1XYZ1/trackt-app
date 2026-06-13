import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { ReportesService, ReporteTabular } from './reportes.service';
import { toCsv } from './csv.util';
import {
  ReporteBaseQueryDto,
  ReporteHistorialQueryDto,
  ReporteInventarioQueryDto,
  ReporteMantenimientosQueryDto,
  ReporteOrdenesQueryDto,
  ReporteTicketsQueryDto,
} from './dto/reportes-query.dto';

// Reportes para administración: admin y jefe_taller. formato=json|csv.
@UseGuards(AuthGuard, RolesGuard)
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Roles('admin', 'jefe_taller')
  @Get('equipos')
  async equipos(
    @TenantId() tenantId: string,
    @Query() query: ReporteBaseQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reporte = await this.reportes.reporteEquipos(tenantId);
    return this.responder(res, reporte, query.formato);
  }

  @Roles('admin', 'jefe_taller')
  @Get('equipos/:id/historial')
  async historialEquipo(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query() query: ReporteHistorialQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { historial, tabular } = await this.reportes.reporteHistorialEquipo(
      tenantId,
      id,
      query,
    );
    if (query.formato === 'csv') {
      return this.responder(res, tabular, 'csv');
    }
    return historial;
  }

  @Roles('admin', 'jefe_taller')
  @Get('ordenes')
  async ordenes(
    @TenantId() tenantId: string,
    @Query() query: ReporteOrdenesQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reporte = await this.reportes.reporteOrdenes(tenantId, query);
    return this.responder(res, reporte, query.formato);
  }

  @Roles('admin', 'jefe_taller')
  @Get('tickets')
  async tickets(
    @TenantId() tenantId: string,
    @Query() query: ReporteTicketsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reporte = await this.reportes.reporteTickets(tenantId, query);
    return this.responder(res, reporte, query.formato);
  }

  @Roles('admin', 'jefe_taller')
  @Get('inventario')
  async inventario(
    @TenantId() tenantId: string,
    @Query() query: ReporteInventarioQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reporte = await this.reportes.reporteInventario(tenantId, query);
    return this.responder(res, reporte, query.formato);
  }

  @Roles('admin', 'jefe_taller')
  @Get('mantenimientos')
  async mantenimientos(
    @TenantId() tenantId: string,
    @Query() query: ReporteMantenimientosQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const reporte = await this.reportes.reporteMantenimientos(tenantId, query);
    return this.responder(res, reporte, query.formato);
  }

  // CSV: archivo descargable. JSON (default): rows + total.
  private responder(
    res: Response,
    reporte: ReporteTabular,
    formato?: 'json' | 'csv',
  ) {
    if (formato === 'csv') {
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${reporte.filename}.csv"`,
      });
      return toCsv(reporte.headers, reporte.rows);
    }
    return { data: reporte.rows, total: reporte.rows.length };
  }
}
