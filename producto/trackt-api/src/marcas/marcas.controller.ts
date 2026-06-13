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
import { MarcasService } from './marcas.service';
import { CreateMarcaDto } from './dto/create-marca.dto';
import { UpdateMarcaDto } from './dto/update-marca.dto';
import { ListMarcasQueryDto } from './dto/list-marcas-query.dto';

@UseGuards(AuthGuard, RolesGuard)
@Controller('marcas')
export class MarcasController {
  constructor(private readonly marcasService: MarcasService) {}

  // Todos los roles listan: los formularios de equipos/repuestos consumen
  // el catálogo (mechanic incluido).
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: ListMarcasQueryDto,
  ) {
    return this.marcasService.findAll(tenantId, query);
  }

  @Roles('admin')
  @Post()
  async create(@TenantId() tenantId: string, @Body() dto: CreateMarcaDto) {
    return this.marcasService.create(tenantId, dto);
  }

  @Roles('admin')
  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMarcaDto,
  ) {
    return this.marcasService.update(tenantId, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/desactivar')
  async desactivar(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.marcasService.desactivar(tenantId, id);
  }
}
