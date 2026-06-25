import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../auth/types';
import { TenantService } from '../common/tenant/tenant.service';
import { InventarioService } from './inventario.service';
import { CreateRepuestoDto } from './dto/create-repuesto.dto';
import { UpdateRepuestoDto } from './dto/update-repuesto.dto';
import { ListRepuestosQueryDto } from './dto/list-repuestos-query.dto';
import { EntradaStockDto } from './dto/entrada-stock.dto';
import { AjusteStockDto } from './dto/ajuste-stock.dto';
import { ListMovimientosQueryDto } from './dto/list-movimientos-query.dto';
import { QrPdfService } from '../common/qr/qr-pdf.service';
import { SITE_URL } from '../common/qr/qr-url';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('inventario')
export class InventarioController {
  constructor(
    private readonly inventarioService: InventarioService,
    private readonly tenantService: TenantService,
    private readonly qrPdfService: QrPdfService,
  ) {}

  // ---------- Repuestos ----------

  @Roles('admin', 'jefe_inventario')
  @Post('repuestos')
  async createRepuesto(
    @Req() req: RequestWithUser,
    @Body() dto: CreateRepuestoDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.createRepuesto(tenantId, req.user.id, dto);
  }

  @Roles('admin', 'jefe_taller', 'jefe_inventario', 'mechanic')
  @Get('repuestos')
  async findAllRepuestos(
    @Req() req: RequestWithUser,
    @Query() query: ListRepuestosQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.findAllRepuestos(tenantId, req.user, query);
  }

  // Resolución por QR: declarada antes de :id para que "qr" no se capture como
  // un id de repuesto. Requiere auth: el QR de otro tenant responde 404.
  @Roles('admin', 'jefe_taller', 'jefe_inventario', 'mechanic')
  @Get('repuestos/qr/:token')
  async findByQr(@Req() req: RequestWithUser, @Param('token') token: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.findByQrToken(tenantId, token);
  }

  @Roles('admin', 'jefe_taller', 'jefe_inventario', 'mechanic')
  @Get('repuestos/:id')
  async findOneRepuesto(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.findOneRepuesto(tenantId, req.user, id);
  }

  // PDF descargable del código QR del repuesto, personalizado por tenant.
  @Roles('admin', 'jefe_taller', 'jefe_inventario', 'mechanic')
  @Get('repuestos/:id/qr/pdf')
  async qrPdf(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    const data = await this.inventarioService.getQrPdfData(tenantId, id);
    const buffer = await this.qrPdfService.buildQrPdf({
      tenantNombre: data.tenantNombre,
      titulo: 'Código QR del repuesto',
      codigo: data.codigo,
      nombre: data.nombre,
      url: `${SITE_URL}/r/${data.qrToken}`,
    });
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="QR-${data.codigo}.pdf"`,
    });
    return new StreamableFile(buffer);
  }

  @Roles('admin', 'jefe_inventario')
  @Patch('repuestos/:id')
  async updateRepuesto(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateRepuestoDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.updateRepuesto(tenantId, id, dto);
  }

  @Roles('admin', 'jefe_inventario')
  @HttpCode(HttpStatus.OK)
  @Patch('repuestos/:id/desactivar')
  async desactivarRepuesto(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.desactivarRepuesto(tenantId, id);
  }

  // Genera o regenera el token QR del repuesto (invalida el anterior). El QR
  // nace por defecto al crear el repuesto; este endpoint queda como utilidad.
  @Roles('admin', 'jefe_inventario')
  @HttpCode(HttpStatus.OK)
  @Post('repuestos/:id/qr')
  async generarQr(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.generarQr(tenantId, id);
  }

  // ---------- Stock ----------

  @Roles('admin', 'jefe_inventario')
  @HttpCode(HttpStatus.OK)
  @Post('repuestos/:id/entrada')
  async entrada(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: EntradaStockDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.entradaStock(tenantId, req.user.id, id, dto);
  }

  @Roles('admin', 'jefe_inventario')
  @HttpCode(HttpStatus.OK)
  @Post('repuestos/:id/ajuste')
  async ajuste(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: AjusteStockDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.ajusteStock(tenantId, req.user.id, id, dto);
  }

  // ---------- Movimientos ----------

  @Roles('admin', 'jefe_taller', 'jefe_inventario')
  @Get('movimientos')
  async findAllMovimientos(
    @Req() req: RequestWithUser,
    @Query() query: ListMovimientosQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.findAllMovimientos(tenantId, query);
  }
}
