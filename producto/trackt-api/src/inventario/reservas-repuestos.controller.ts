import {
  Body,
  Controller,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { InventarioService } from './inventario.service';
import { AprobarReservaDto } from './dto/aprobar-reserva.dto';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { ReservaActionDto } from './dto/reserva-action.dto';

/**
 * Endpoints de reservas montados en dos prefijos distintos:
 *   /tickets/:ticketId/reservas-repuestos  → crear y listar (anidado al ticket)
 *   /reservas-repuestos/:id/...            → liberar / consumir (operación sobre la reserva)
 *
 * Para evitar colisión con TicketsController (que monta paths como /tickets/:id),
 * la ruta anidada usa un sufijo único `reservas-repuestos`.
 */
@UseGuards(AuthGuard, RolesGuard)
@Controller()
export class ReservasRepuestosController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Post('tickets/:ticketId/reservas-repuestos')
  async createReserva(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateReservaDto,
  ) {
    return this.inventarioService.createReserva(tenantId, user, ticketId, dto);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get('tickets/:ticketId/reservas-repuestos')
  async findReservasByTicket(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('ticketId') ticketId: string,
  ) {
    return this.inventarioService.findReservasByTicket(
      tenantId,
      user,
      ticketId,
    );
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @HttpCode(HttpStatus.OK)
  @Post('reservas-repuestos/:id/liberar')
  async liberar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReservaActionDto,
  ) {
    return this.inventarioService.liberarReserva(tenantId, user, id, dto);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @HttpCode(HttpStatus.OK)
  @Post('reservas-repuestos/:id/consumir')
  async consumir(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReservaActionDto,
  ) {
    return this.inventarioService.consumirReserva(tenantId, user, id, dto);
  }

  /**
   * Aprobar reserva SOLICITADA → RESERVADA. Aplica stockReservado y emite
   * movimiento RESERVA por item. Solo admin/jefe_taller.
   */
  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Post('reservas-repuestos/:id/aprobar')
  async aprobar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AprobarReservaDto,
  ) {
    return this.inventarioService.aprobarReserva(tenantId, user, id, dto);
  }

  /**
   * Listado global de reservas pendientes (SOLICITADA) del tenant.
   * Solo admin/jefe_taller. Mechanic accede a sus reservas via el endpoint
   * anidado /tickets/:ticketId/reservas-repuestos.
   */
  @Roles('admin', 'jefe_taller')
  @Get('reservas-repuestos')
  async findPendientes(@TenantId() tenantId: string) {
    return this.inventarioService.findReservasPendientes(tenantId);
  }
}
