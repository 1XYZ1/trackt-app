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
import { EvidenciasService } from './evidencias.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

@UseGuards(AuthGuard, RolesGuard)
@Controller('tickets')
export class EvidenciasController {
  constructor(private readonly evidenciasService: EvidenciasService) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @HttpCode(HttpStatus.OK)
  @Post(':id/evidencia/signed-url')
  async requestSignedUrl(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') ticketId: string,
    @Body() dto: RequestUploadDto,
  ) {
    return this.evidenciasService.requestUploadUrl(
      tenantId,
      user,
      ticketId,
      dto,
    );
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Post(':id/evidencia')
  async confirm(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') ticketId: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    return this.evidenciasService.confirmUpload(tenantId, user, ticketId, dto);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id/evidencias')
  async list(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') ticketId: string,
  ) {
    return this.evidenciasService.listForTicket(tenantId, user, ticketId);
  }
}
