import {
  Body,
  Controller,
  Delete,
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
import { TenantService } from '../common/tenant/tenant.service';
import { AuthUser } from '../auth/types';
import { TiposEquipoService } from './tipos-equipo.service';
import { CreateTipoEquipoDto } from './dto/create-tipo-equipo.dto';
import { UpdateTipoEquipoDto } from './dto/update-tipo-equipo.dto';
import { ListTiposEquipoQueryDto } from './dto/list-tipos-equipo-query.dto';
import { AddTipoEquipoRepuestoDto } from './dto/add-tipo-equipo-repuesto.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

// Catálogo de tipos de equipo + repuestos default. Lectura para todo el tenant
// (los formularios de equipos consumen el catálogo); escritura admin/jefe_taller.
@UseGuards(AuthGuard, RolesGuard)
@Controller('tipos-equipo')
export class TiposEquipoController {
  constructor(
    private readonly tiposEquipoService: TiposEquipoService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'jefe_taller', 'mechanic', 'jefe_inventario')
  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListTiposEquipoQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.tiposEquipoService.findAll(tenantId, query);
  }

  @Roles('admin', 'jefe_taller', 'mechanic', 'jefe_inventario')
  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.tiposEquipoService.findOne(tenantId, id);
  }

  @Roles('admin', 'jefe_taller')
  @Post()
  async create(@Req() req: RequestWithUser, @Body() dto: CreateTipoEquipoDto) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.tiposEquipoService.create(tenantId, dto);
  }

  @Roles('admin', 'jefe_taller')
  @Patch(':id')
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateTipoEquipoDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.tiposEquipoService.update(tenantId, id, dto);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/desactivar')
  async desactivar(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.tiposEquipoService.desactivar(tenantId, id);
  }

  // ---------- Repuestos default ----------

  @Roles('admin', 'jefe_taller', 'mechanic', 'jefe_inventario')
  @Get(':id/repuestos')
  async listRepuestos(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.tiposEquipoService.listRepuestos(tenantId, id);
  }

  @Roles('admin', 'jefe_taller')
  @Post(':id/repuestos')
  async addRepuesto(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: AddTipoEquipoRepuestoDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.tiposEquipoService.addRepuesto(tenantId, id, dto);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Delete(':id/repuestos/:repuestoId')
  async removeRepuesto(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('repuestoId') repuestoId: string,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.tiposEquipoService.removeRepuesto(tenantId, id, repuestoId);
  }
}
