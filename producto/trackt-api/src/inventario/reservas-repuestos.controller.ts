import {
  Body,
  Controller,
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
import { AuthUser } from '../auth/types';
import { TenantService } from '../common/tenant/tenant.service';
import { InventarioService } from './inventario.service';
import { AprobarReservaDto } from './dto/aprobar-reserva.dto';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { ReservaActionDto } from './dto/reserva-action.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

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
  constructor(
    private readonly inventarioService: InventarioService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Post('tickets/:ticketId/reservas-repuestos')
  async createReserva(
    @Req() req: RequestWithUser,
    @Param('ticketId') ticketId: string,
    @Body() dto: CreateReservaDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.createReserva(
      tenantId,
      req.user,
      ticketId,
      dto,
    );
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get('tickets/:ticketId/reservas-repuestos')
  async findReservasByTicket(
    @Req() req: RequestWithUser,
    @Param('ticketId') ticketId: string,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.findReservasByTicket(
      tenantId,
      req.user,
      ticketId,
    );
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @HttpCode(HttpStatus.OK)
  @Post('reservas-repuestos/:id/liberar')
  async liberar(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ReservaActionDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.liberarReserva(tenantId, req.user, id, dto);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @HttpCode(HttpStatus.OK)
  @Post('reservas-repuestos/:id/consumir')
  async consumir(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ReservaActionDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.consumirReserva(tenantId, req.user, id, dto);
  }

  /**
   * Aprobar reserva SOLICITADA → RESERVADA. Aplica stockReservado y emite
   * movimiento RESERVA por item. Solo admin/jefe_taller.
   */
  @Roles('admin', 'jefe_taller')
  @HttpCode(HttpStatus.OK)
  @Post('reservas-repuestos/:id/aprobar')
  async aprobar(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: AprobarReservaDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.aprobarReserva(tenantId, req.user, id, dto);
  }

  /**
   * Listado global de reservas pendientes (SOLICITADA) del tenant.
   * Solo admin/jefe_taller. Mechanic accede a sus reservas via el endpoint
   * anidado /tickets/:ticketId/reservas-repuestos.
   */
  @Roles('admin', 'jefe_taller')
  @Get('reservas-repuestos')
  async findPendientes(@Req() req: RequestWithUser) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.inventarioService.findReservasPendientes(tenantId);
  }
}
