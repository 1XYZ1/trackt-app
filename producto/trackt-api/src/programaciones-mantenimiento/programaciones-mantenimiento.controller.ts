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
import { ProgramacionesMantenimientoService } from './programaciones-mantenimiento.service';
import { CreateProgramacionDto } from './dto/create-programacion.dto';
import { UpdateProgramacionDto } from './dto/update-programacion.dto';
import { ListProgramacionesQueryDto } from './dto/list-programaciones-query.dto';
import { CalendarioQueryDto } from './dto/calendario-query.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

// Programación de mantenimientos. Lectura para todo el tenant (mechanic ve
// el calendario del taller); escritura admin/jefe_taller, que planifican.
@UseGuards(AuthGuard, RolesGuard)
@Controller('programaciones-mantenimiento')
export class ProgramacionesMantenimientoController {
  constructor(
    private readonly service: ProgramacionesMantenimientoService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListProgramacionesQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.findAll(tenantId, query);
  }

  // Debe declararse antes de :id para que "calendario" no matchee como id.
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get('calendario')
  async calendario(
    @Req() req: RequestWithUser,
    @Query() query: CalendarioQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.calendario(tenantId, query);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.findOne(tenantId, id);
  }

  @Roles('admin', 'jefe_taller')
  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateProgramacionDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.create(tenantId, dto);
  }

  @Roles('admin', 'jefe_taller')
  @Patch(':id')
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateProgramacionDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.update(tenantId, id, dto);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/cancelar')
  async cancelar(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.cancelar(tenantId, id);
  }
}
