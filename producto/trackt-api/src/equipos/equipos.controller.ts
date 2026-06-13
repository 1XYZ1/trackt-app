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
import { EquiposService } from './equipos.service';
import { ListEquiposQueryDto } from './dto/list-equipos-query.dto';
import { CreateEquipoDto } from './dto/create-equipo.dto';
import { UpdateEquipoDto } from './dto/update-equipo.dto';
import { HistorialQueryDto } from './dto/historial-query.dto';

@UseGuards(AuthGuard, RolesGuard)
@Controller('equipos')
export class EquiposController {
  constructor(private readonly equiposService: EquiposService) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: ListEquiposQueryDto,
  ) {
    return this.equiposService.findAll(tenantId, query);
  }

  // Resolución por QR: declarado antes de :id por claridad de ruteo.
  // Requiere auth: el QR de otro tenant responde 404.
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get('qr/:qrToken')
  async findByQr(
    @TenantId() tenantId: string,
    @Param('qrToken') qrToken: string,
  ) {
    return this.equiposService.findByQrToken(tenantId, qrToken);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.equiposService.findOne(tenantId, id);
  }

  // Ficha central del equipo: datos + estadísticas + últimas OTs/tickets + alertas.
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id/resumen')
  async resumen(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.equiposService.resumen(tenantId, id);
  }

  // Historial completo: OTs, tickets, evidencias, reservas, movimientos,
  // consumo por repuesto y programaciones (Fase 6).
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id/historial')
  async historial(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Query() query: HistorialQueryDto,
  ) {
    return this.equiposService.historial(tenantId, id, query);
  }

  @Roles('admin')
  @Post()
  async create(@TenantId() tenantId: string, @Body() dto: CreateEquipoDto) {
    return this.equiposService.create(tenantId, dto);
  }

  @Roles('admin')
  @Patch(':id')
  async update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEquipoDto,
  ) {
    return this.equiposService.update(tenantId, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Patch(':id/desactivar')
  async desactivar(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.equiposService.desactivar(tenantId, id);
  }

  // Genera o regenera el token QR del equipo (invalida el anterior).
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Post(':id/qr')
  async generarQr(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.equiposService.generarQr(tenantId, id);
  }
}
