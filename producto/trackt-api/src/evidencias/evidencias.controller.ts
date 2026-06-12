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
import { EvidenciasService } from './evidencias.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('tickets')
export class EvidenciasController {
  constructor(
    private readonly evidenciasService: EvidenciasService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @HttpCode(HttpStatus.OK)
  @Post(':id/evidencia/signed-url')
  async requestSignedUrl(
    @Req() req: RequestWithUser,
    @Param('id') ticketId: string,
    @Body() dto: RequestUploadDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.evidenciasService.requestUploadUrl(
      tenantId,
      req.user,
      ticketId,
      dto,
    );
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Post(':id/evidencia')
  async confirm(
    @Req() req: RequestWithUser,
    @Param('id') ticketId: string,
    @Body() dto: ConfirmUploadDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.evidenciasService.confirmUpload(
      tenantId,
      req.user,
      ticketId,
      dto,
    );
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get(':id/evidencias')
  async list(@Req() req: RequestWithUser, @Param('id') ticketId: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.evidenciasService.listForTicket(tenantId, req.user, ticketId);
  }
}
