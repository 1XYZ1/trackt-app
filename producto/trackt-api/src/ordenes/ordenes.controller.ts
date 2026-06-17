import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../auth/types';
import { TenantService } from '../common/tenant/tenant.service';
import { OrdenesService } from './ordenes.service';
import { OrdenesPdfService } from './ordenes-pdf.service';
import { CreateOrdenDto } from './dto/create-orden.dto';
import { UpdateOrdenDto } from './dto/update-orden.dto';
import { ListOrdenesQueryDto } from './dto/list-ordenes-query.dto';
import { TicketsService } from '../tickets/tickets.service';
import { CreateTicketDto } from '../tickets/dto/create-ticket.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('ordenes')
export class OrdenesController {
  constructor(
    private readonly ordenesService: OrdenesService,
    private readonly ordenesPdfService: OrdenesPdfService,
    @Inject(forwardRef(() => TicketsService))
    private readonly ticketsService: TicketsService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'mechanic')
  @Post()
  async create(@Req() req: RequestWithUser, @Body() dto: CreateOrdenDto) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ordenesService.create(tenantId, req.user.id, dto);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListOrdenesQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ordenesService.findAll(tenantId, query);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ordenesService.findOne(tenantId, id);
  }

  // PDF imprimible de la OT (Fase 6): ficha completa con tickets, reservas,
  // consumos, evidencias y espacio para firmas.
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id/pdf')
  async pdf(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    const { buffer, filename } = await this.ordenesPdfService.generarPdf(
      tenantId,
      id,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Roles('admin', 'mechanic')
  @Patch(':id')
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrdenDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ordenesService.update(tenantId, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancelar')
  async cancelar(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ordenesService.cancelar(tenantId, req.user.id, id);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Post(':otId/tickets')
  async createTicket(
    @Req() req: RequestWithUser,
    @Param('otId') otId: string,
    @Body() dto: CreateTicketDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ticketsService.createFromOrden(
      tenantId,
      req.user.id,
      otId,
      dto,
    );
  }
}
