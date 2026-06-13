import {
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
import { EquiposPlantillasService } from './equipos-plantillas.service';

// Plantillas de mantenimiento por equipo. Lectura para todo el tenant;
// escritura admin/jefe_taller — mismo criterio que equipos_repuestos.
@UseGuards(AuthGuard, RolesGuard)
@Controller('equipos')
export class EquiposPlantillasController {
  constructor(private readonly service: EquiposPlantillasService) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':equipoId/plantillas')
  async list(
    @TenantId() tenantId: string,
    @Param('equipoId') equipoId: string,
  ) {
    return this.service.list(tenantId, equipoId);
  }

  @Roles('admin', 'jefe_taller')
  @Post(':equipoId/plantillas/:plantillaId')
  async add(
    @TenantId() tenantId: string,
    @Param('equipoId') equipoId: string,
    @Param('plantillaId') plantillaId: string,
  ) {
    return this.service.add(tenantId, equipoId, plantillaId);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Delete(':equipoId/plantillas/:plantillaId')
  async remove(
    @TenantId() tenantId: string,
    @Param('equipoId') equipoId: string,
    @Param('plantillaId') plantillaId: string,
  ) {
    return this.service.remove(tenantId, equipoId, plantillaId);
  }
}
