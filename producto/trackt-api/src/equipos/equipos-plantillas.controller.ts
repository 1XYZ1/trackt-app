import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TenantService } from '../common/tenant/tenant.service';
import { AuthUser } from '../auth/types';
import { EquiposPlantillasService } from './equipos-plantillas.service';

interface RequestWithUser extends Request {
  user: AuthUser;
}

// Plantillas de mantenimiento por equipo. Lectura para todo el tenant;
// escritura admin/jefe_taller — mismo criterio que equipos_repuestos.
@UseGuards(AuthGuard, RolesGuard)
@Controller('equipos')
export class EquiposPlantillasController {
  constructor(
    private readonly service: EquiposPlantillasService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':equipoId/plantillas')
  async list(@Req() req: RequestWithUser, @Param('equipoId') equipoId: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.list(tenantId, equipoId);
  }

  @Roles('admin', 'jefe_taller')
  @Post(':equipoId/plantillas/:plantillaId')
  async add(
    @Req() req: RequestWithUser,
    @Param('equipoId') equipoId: string,
    @Param('plantillaId') plantillaId: string,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.add(tenantId, equipoId, plantillaId);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Delete(':equipoId/plantillas/:plantillaId')
  async remove(
    @Req() req: RequestWithUser,
    @Param('equipoId') equipoId: string,
    @Param('plantillaId') plantillaId: string,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.remove(tenantId, equipoId, plantillaId);
  }
}
