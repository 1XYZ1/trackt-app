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
import { HistorialQueryDto } from './dto/historial-query.dto';

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

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListEquiposQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.findAll(tenantId, query);
  }

  // Resolución por QR: declarado antes de :id por claridad de ruteo.
  // Requiere auth: el QR de otro tenant responde 404.
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get('qr/:qrToken')
  async findByQr(
    @Req() req: RequestWithUser,
    @Param('qrToken') qrToken: string,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.findByQrToken(tenantId, qrToken);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.findOne(tenantId, id);
  }

  // Ficha central del equipo: datos + estadísticas + últimas OTs/tickets + alertas.
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id/resumen')
  async resumen(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.resumen(tenantId, id);
  }

  // Historial completo: OTs, tickets, evidencias, reservas, movimientos,
  // consumo por repuesto y programaciones (Fase 6).
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id/historial')
  async historial(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query() query: HistorialQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.historial(tenantId, id, query);
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

  // Genera o regenera el token QR del equipo (invalida el anterior).
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Post(':id/qr')
  async generarQr(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.generarQr(tenantId, id);
  }
}
