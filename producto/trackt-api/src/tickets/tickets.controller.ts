import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../auth/types';
import { TenantService } from '../common/tenant/tenant.service';
import { TicketsService } from './tickets.service';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';
import { AsignarTicketDto } from './dto/asignar-ticket.dto';
import { FinalizarTicketDto } from './dto/finalizar-ticket.dto';
import { ValidarTicketDto } from './dto/validar-ticket.dto';
import { CerrarTicketDto } from './dto/cerrar-ticket.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'mechanic')
  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListTicketsQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ticketsService.findAll(tenantId, query);
  }

  @Roles('admin', 'mechanic')
  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ticketsService.findOne(tenantId, id);
  }

  // ---------- Transiciones de estado (TRA-27) ----------

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Post(':id/asignar')
  async asignar(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: AsignarTicketDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ticketsService.asignar(tenantId, req.user.id, id, dto);
  }

  @Roles('mechanic')
  @HttpCode(HttpStatus.OK)
  @Post(':id/iniciar')
  async iniciar(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ticketsService.iniciar(tenantId, req.user.id, id);
  }

  @Roles('mechanic')
  @HttpCode(HttpStatus.OK)
  @Post(':id/finalizar')
  async finalizar(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: FinalizarTicketDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ticketsService.finalizar(tenantId, req.user.id, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Post(':id/validar')
  async validar(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ValidarTicketDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ticketsService.validar(tenantId, req.user.id, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cerrar')
  async cerrar(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: CerrarTicketDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ticketsService.cerrar(tenantId, req.user.id, id, dto);
  }
}
