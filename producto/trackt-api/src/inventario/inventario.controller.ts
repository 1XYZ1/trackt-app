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
  UseGuards,
} from '@nestjs/common';
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

interface RequestWithUser extends Request {
  user: AuthUser;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('inventario')
export class InventarioController {
  constructor(
    private readonly inventarioService: InventarioService,
    private readonly tenantService: TenantService,
  ) {}

  // ---------- Repuestos ----------

  @Roles('admin')
  @Post('repuestos')
  async createRepuesto(
    @Req() req: RequestWithUser,
    @Body() dto: CreateRepuestoDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.createRepuesto(tenantId, req.user.id, dto);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get('repuestos')
  async findAllRepuestos(
    @Req() req: RequestWithUser,
    @Query() query: ListRepuestosQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.findAllRepuestos(tenantId, req.user, query);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get('repuestos/:id')
  async findOneRepuesto(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.findOneRepuesto(tenantId, req.user, id);
  }

  @Roles('admin')
  @Patch('repuestos/:id')
  async updateRepuesto(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateRepuestoDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.updateRepuesto(tenantId, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Patch('repuestos/:id/desactivar')
  async desactivarRepuesto(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.desactivarRepuesto(tenantId, id);
  }

  // ---------- Stock ----------

  @Roles('admin')
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

  @Roles('admin')
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

  @Roles('admin', 'jefe_taller')
  @Get('movimientos')
  async findAllMovimientos(
    @Req() req: RequestWithUser,
    @Query() query: ListMovimientosQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.findAllMovimientos(tenantId, query);
  }
}
