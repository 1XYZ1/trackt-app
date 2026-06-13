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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { InventarioService } from './inventario.service';
import { CreateRepuestoDto } from './dto/create-repuesto.dto';
import { UpdateRepuestoDto } from './dto/update-repuesto.dto';
import { ListRepuestosQueryDto } from './dto/list-repuestos-query.dto';
import { EntradaStockDto } from './dto/entrada-stock.dto';
import { AjusteStockDto } from './dto/ajuste-stock.dto';
import { ListMovimientosQueryDto } from './dto/list-movimientos-query.dto';

@UseGuards(AuthGuard, RolesGuard)
@Controller('inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  // ---------- Repuestos ----------

  @Roles('admin')
  @Post('repuestos')
  async createRepuesto(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRepuestoDto,
  ) {
    return this.inventarioService.createRepuesto(tenantId, user.id, dto);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get('repuestos')
  async findAllRepuestos(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListRepuestosQueryDto,
  ) {
    return this.inventarioService.findAllRepuestos(tenantId, user, query);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get('repuestos/:id')
  async findOneRepuesto(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.inventarioService.findOneRepuesto(tenantId, user, id);
  }

  @Roles('admin')
  @Patch('repuestos/:id')
  async updateRepuesto(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRepuestoDto,
  ) {
    return this.inventarioService.updateRepuesto(tenantId, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Patch('repuestos/:id/desactivar')
  async desactivarRepuesto(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.inventarioService.desactivarRepuesto(tenantId, id);
  }

  // ---------- Stock ----------

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Post('repuestos/:id/entrada')
  async entrada(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: EntradaStockDto,
  ) {
    return this.inventarioService.entradaStock(tenantId, user.id, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Post('repuestos/:id/ajuste')
  async ajuste(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AjusteStockDto,
  ) {
    return this.inventarioService.ajusteStock(tenantId, user.id, id, dto);
  }

  // ---------- Movimientos ----------

  @Roles('admin', 'jefe_taller')
  @Get('movimientos')
  async findAllMovimientos(
    @TenantId() tenantId: string,
    @Query() query: ListMovimientosQueryDto,
  ) {
    return this.inventarioService.findAllMovimientos(tenantId, query);
  }
}
