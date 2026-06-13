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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { PlantillasMantenimientoService } from './plantillas-mantenimiento.service';
import { CreatePlantillaDto } from './dto/create-plantilla.dto';
import { UpdatePlantillaDto } from './dto/update-plantilla.dto';
import { ListPlantillasQueryDto } from './dto/list-plantillas-query.dto';
import { AddPlantillaItemDto } from './dto/add-plantilla-item.dto';
import { UpdatePlantillaItemDto } from './dto/update-plantilla-item.dto';

// Plantillas de mantenimiento. Lectura para todo el tenant (mechanic
// consulta la receta al ejecutar); escritura admin/jefe_taller, que son
// quienes definen los estándares de mantención.
@UseGuards(AuthGuard, RolesGuard)
@Controller('plantillas-mantenimiento')
export class PlantillasMantenimientoController {
  constructor(private readonly service: PlantillasMantenimientoService) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: ListPlantillasQueryDto,
  ) {
    return this.service.findAll(tenantId, query);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Roles('admin', 'jefe_taller')
  @Post()
  async create(@TenantId() tenantId: string, @Body() dto: CreatePlantillaDto) {
    return this.service.create(tenantId, dto);
  }

  @Roles('admin', 'jefe_taller')
  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePlantillaDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/desactivar')
  async desactivar(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.desactivar(tenantId, id);
  }

  // ---------- items ----------

  @Roles('admin', 'jefe_taller')
  @Post(':id/items')
  async addItem(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddPlantillaItemDto,
  ) {
    return this.service.addItem(tenantId, id, dto);
  }

  @Roles('admin', 'jefe_taller')
  @Patch(':id/items/:itemId')
  async updateItem(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdatePlantillaItemDto,
  ) {
    return this.service.updateItem(tenantId, id, itemId, dto);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Delete(':id/items/:itemId')
  async removeItem(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeItem(tenantId, id, itemId);
  }
}
