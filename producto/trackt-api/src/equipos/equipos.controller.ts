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
import { EquiposService } from './equipos.service';
import { ListEquiposQueryDto } from './dto/list-equipos-query.dto';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { TenantService } from '../common/tenant/tenant.service';
import { AuthUser } from '../auth/types';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('equipos')
export class EquiposController {
  constructor(
    private readonly equiposService: EquiposService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'mechanic')
  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListEquiposQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.findAll(tenantId, query);
  }

  @Roles('admin', 'mechanic')
  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.findOne(tenantId, id);
  }

  @Roles('admin')
  @Post()
  async create(@Req() req: RequestWithUser, @Body() dto: CreateEquipoDto) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.create(tenantId, dto);
  }

  @Roles('admin')
  @Patch(':id')
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateEquipoDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.update(tenantId, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/desactivar')
  async desactivar(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.desactivar(tenantId, id);
  }
}
