import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { EquiposRepuestosService } from './equipos-repuestos.service';
import { AddEquipoRepuestoDto } from './dto/add-equipo-repuesto.dto';

// Repuestos habituales por equipo. Lectura para todo el tenant (mechanic
// consulta qué insumos usa el equipo); escritura admin/jefe_taller.
@UseGuards(AuthGuard, RolesGuard)
@Controller('equipos')
export class EquiposRepuestosController {
  constructor(private readonly service: EquiposRepuestosService) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id/repuestos')
  async list(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.service.list(tenantId, id);
  }

  @Roles('admin', 'jefe_taller')
  @Post(':id/repuestos')
  async add(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: AddEquipoRepuestoDto,
  ) {
    return this.service.add(tenantId, id, dto);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Delete(':id/repuestos/:repuestoId')
  async remove(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Param('repuestoId') repuestoId: string,
  ) {
    return this.service.remove(tenantId, id, repuestoId);
  }
}
