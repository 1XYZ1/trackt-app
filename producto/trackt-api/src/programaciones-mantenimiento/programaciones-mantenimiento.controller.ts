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
import { ProgramacionesMantenimientoService } from './programaciones-mantenimiento.service';
import { CreateProgramacionDto } from './dto/create-programacion.dto';
import { UpdateProgramacionDto } from './dto/update-programacion.dto';
import { ListProgramacionesQueryDto } from './dto/list-programaciones-query.dto';
import { CalendarioQueryDto } from './dto/calendario-query.dto';
import { GenerarOtDto } from './dto/generar-ot.dto';

// Programación de mantenimientos. Lectura para todo el tenant (mechanic ve
// el calendario del taller); escritura admin/jefe_taller, que planifican.
@UseGuards(AuthGuard, RolesGuard)
@Controller('programaciones-mantenimiento')
export class ProgramacionesMantenimientoController {
  constructor(private readonly service: ProgramacionesMantenimientoService) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: ListProgramacionesQueryDto,
  ) {
    return this.service.findAll(tenantId, query);
  }

  // Debe declararse antes de :id para que "calendario" no matchee como id.
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get('calendario')
  async calendario(
    @TenantId() tenantId: string,
    @Query() query: CalendarioQueryDto,
  ) {
    return this.service.calendario(tenantId, query);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.findOne(tenantId, id);
  }

  @Roles('admin', 'jefe_taller')
  @Post()
  async create(
    @TenantId() tenantId: string,
    @Body() dto: CreateProgramacionDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Roles('admin', 'jefe_taller')
  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProgramacionDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/cancelar')
  async cancelar(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.cancelar(tenantId, id);
  }

  // Flujo principal (Fase 5): programación → OT → ticket → reserva.
  // mechanic también puede generar: su reserva queda SOLICITADA (requiere
  // aprobación de admin/jefe), igual que en los endpoints de tickets.
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Post(':id/generar-ot')
  async generarOt(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: GenerarOtDto,
  ) {
    return this.service.generarOt(tenantId, user, id, dto);
  }
}
