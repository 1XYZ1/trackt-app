import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../auth/types';
import { TenantService } from '../common/tenant/tenant.service';
import { NotificacionesService } from './notificaciones.service';
import { ListNotificacionesQueryDto } from './dto/list-notificaciones-query.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly notificacionesService: NotificacionesService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'mechanic')
  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListNotificacionesQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.notificacionesService.findAll(tenantId, req.user.id, query);
  }

  @Roles('admin', 'mechanic')
  @Get('count-no-leidas')
  async countNoLeidas(@Req() req: RequestWithUser) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    const count = await this.notificacionesService.countNoLeidas(
      tenantId,
      req.user.id,
    );
    return { count };
  }

  @Roles('admin', 'mechanic')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(':id/leer')
  async marcarLeida(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ): Promise<void> {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    await this.notificacionesService.marcarLeida(tenantId, req.user.id, id);
  }

  @Roles('admin', 'mechanic')
  @HttpCode(HttpStatus.OK)
  @Patch('leer-todas')
  async marcarTodasLeidas(@Req() req: RequestWithUser) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.notificacionesService.marcarTodasLeidas(tenantId, req.user.id);
  }
}
