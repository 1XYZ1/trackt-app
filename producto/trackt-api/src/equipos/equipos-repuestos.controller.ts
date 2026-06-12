import {
  Body,
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
import { EquiposRepuestosService } from './equipos-repuestos.service';
import { AddEquipoRepuestoDto } from './dto/add-equipo-repuesto.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

// Repuestos habituales por equipo. Lectura para todo el tenant (mechanic
// consulta qué insumos usa el equipo); escritura admin/jefe_taller.
@UseGuards(AuthGuard, RolesGuard)
@Controller('equipos')
export class EquiposRepuestosController {
  constructor(
    private readonly service: EquiposRepuestosService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id/repuestos')
  async list(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.list(tenantId, id);
  }

  @Roles('admin', 'jefe_taller')
  @Post(':id/repuestos')
  async add(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: AddEquipoRepuestoDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.add(tenantId, id, dto);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Delete(':id/repuestos/:repuestoId')
  async remove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Param('repuestoId') repuestoId: string,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.service.remove(tenantId, id, repuestoId);
  }
}
