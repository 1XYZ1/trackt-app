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
import { PlantillasMantenimientoService } from './plantillas-mantenimiento.service';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';
import { UpdatePlantillaDto } from './dto/update-plantilla.dto';
import { ListPlantillasQueryDto } from './dto/list-plantillas-query.dto';
import { AddPlantillaItemDto } from './dto/add-plantilla-item.dto';
import { UpdatePlantillaItemDto } from './dto/update-plantilla-item.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

// Plantillas de mantenimiento. Lectura para todo el tenant (mechanic
// consulta la receta al ejecutar); escritura admin/jefe_taller, que son
// quienes definen los estándares de mantención.
@UseGuards(AuthGuard, RolesGuard)
@Controller('plantillas-mantenimiento')
export class PlantillasMantenimientoController {
  constructor(
    private readonly service: PlantillasMantenimientoService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListPlantillasQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.findAll(tenantId, query);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.findOne(tenantId, id);
  }

  @Roles('admin', 'jefe_taller')
  @Post()
  async create(@Req() req: RequestWithUser, @Body() dto: CreatePlantillaDto) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.create(tenantId, dto);
  }

  @Roles('admin', 'jefe_taller')
  @Patch(':id')
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdatePlantillaDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.update(tenantId, id, dto);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/desactivar')
  async desactivar(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.desactivar(tenantId, id);
  }

  // ---------- items ----------

  @Roles('admin', 'jefe_taller')
  @Post(':id/items')
  async addItem(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: AddPlantillaItemDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.addItem(tenantId, id, dto);
  }

  @Roles('admin', 'jefe_taller')
  @Patch(':id/items/:itemId')
  async updateItem(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePlantillaItemDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.updateItem(tenantId, id, itemId, dto);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Delete(':id/items/:itemId')
  async removeItem(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.removeItem(tenantId, id, itemId);
  }
}
