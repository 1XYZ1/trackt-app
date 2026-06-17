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
import { TenantService } from '../common/tenant/tenant.service';
import { AuthUser } from '../auth/types';
import { MarcasService } from './marcas.service';
import { CreateMarcaDto } from './dto/create-marca.dto';
import { UpdateMarcaDto } from './dto/update-marca.dto';
import { ListMarcasQueryDto } from './dto/list-marcas-query.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('marcas')
export class MarcasController {
  constructor(
    private readonly marcasService: MarcasService,
    private readonly tenantService: TenantService,
  ) {}

  // Todos los roles listan: los formularios de equipos/repuestos consumen
  // el catálogo (mechanic incluido).
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListMarcasQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.marcasService.findAll(tenantId, query);
  }

  @Roles('admin')
  @Post()
  async create(@Req() req: RequestWithUser, @Body() dto: CreateMarcaDto) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.marcasService.create(tenantId, dto);
  }

  @Roles('admin')
  @Patch(':id')
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateMarcaDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.marcasService.update(tenantId, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/desactivar')
  async desactivar(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.marcasService.desactivar(tenantId, id);
  }
}
