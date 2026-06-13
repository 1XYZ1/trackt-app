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
  Res,
  StreamableFile,
  UseGuards,
  forwardRef,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { OrdenesService } from './ordenes.service';
import { OrdenesPdfService } from './ordenes-pdf.service';
import { CreateOrdenDto } from './dto/create-orden.dto';
import { UpdateOrdenDto } from './dto/update-orden.dto';
import { ListOrdenesQueryDto } from './dto/list-ordenes-query.dto';
import { TicketsService } from '../tickets/tickets.service';
import { CreateTicketDto } from '../tickets/dto/create-ticket.dto';

@UseGuards(AuthGuard, RolesGuard)
@Controller('ordenes')
export class OrdenesController {
  constructor(
    private readonly ordenesService: OrdenesService,
    private readonly ordenesPdfService: OrdenesPdfService,
    @Inject(forwardRef(() => TicketsService))
    private readonly ticketsService: TicketsService,
  ) {}

  @Roles('admin', 'mechanic')
  @Post()
  async create(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrdenDto,
  ) {
    return this.ordenesService.create(tenantId, user.id, dto);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: ListOrdenesQueryDto,
  ) {
    return this.ordenesService.findAll(tenantId, query);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id')
  async findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.ordenesService.findOne(tenantId, id);
  }

  // PDF imprimible de la OT (Fase 6): ficha completa con tickets, reservas,
  // consumos, evidencias y espacio para firmas.
  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id/pdf')
  async pdf(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
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
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrdenDto,
  ) {
    return this.ordenesService.update(tenantId, id, dto);
  }

  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancelar')
  async cancelar(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.ordenesService.cancelar(tenantId, user.id, id);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Post(':otId/tickets')
  async createTicket(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('otId') otId: string,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.createFromOrden(tenantId, user.id, otId, dto);
  }
}
