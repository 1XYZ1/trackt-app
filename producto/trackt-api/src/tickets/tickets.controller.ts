import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { TicketsService } from './tickets.service';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { AsignarTicketDto } from './dto/asignar-ticket.dto';
import { ReasignarTicketDto } from './dto/reasignar-ticket.dto';
import { FinalizarTicketDto } from './dto/finalizar-ticket.dto';
import { ValidarTicketDto } from './dto/validar-ticket.dto';
import { CerrarTicketDto } from './dto/cerrar-ticket.dto';

@UseGuards(AuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListTicketsQueryDto,
  ) {
    return this.ticketsService.findAll(tenantId, user, query);
  }

  // GET /tickets/carga-mecanicos: resumen de carga operativa por mecánico.
  // Solo admin y jefe_taller — mechanic no debe ver carga ajena.
  // IMPORTANTE: declarado antes de :id para que Express no lo capture como :id.
  @Roles('admin', 'jefe_taller')
  @Get('carga-mecanicos')
  async cargaMecanicos(@TenantId() tenantId: string) {
    return this.ticketsService.getCargaMecanicos(tenantId);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id')
  async findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.ticketsService.findOne(tenantId, user, id);
  }

  // ---------- Transiciones de estado (TRA-27) ----------

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Post(':id/asignar')
  async asignar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AsignarTicketDto,
  ) {
    return this.ticketsService.asignar(tenantId, user.id, id, dto);
  }

  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Post(':id/reasignar')
  async reasignar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReasignarTicketDto,
  ) {
    return this.ticketsService.reasignar(tenantId, user.id, id, dto);
  }

  @Roles('mechanic')
  @HttpCode(HttpStatus.OK)
  @Post(':id/iniciar')
  async iniciar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.ticketsService.iniciar(tenantId, user.id, id);
  }

  @Roles('mechanic')
  @HttpCode(HttpStatus.OK)
  @Post(':id/finalizar')
  async finalizar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: FinalizarTicketDto,
  ) {
    return this.ticketsService.finalizar(tenantId, user.id, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Post(':id/validar')
  async validar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ValidarTicketDto,
  ) {
    return this.ticketsService.validar(tenantId, user.id, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cerrar')
  async cerrar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CerrarTicketDto,
  ) {
    return this.ticketsService.cerrar(tenantId, user.id, id, dto);
  }
}
