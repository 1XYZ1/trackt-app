import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { NotificacionesService } from './notificaciones.service';
import { ListNotificacionesQueryDto } from './dto/list-notificaciones-query.dto';

@UseGuards(AuthGuard, RolesGuard)
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificacionesQueryDto,
  ) {
    return this.notificacionesService.findAll(tenantId, user.id, query);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @Get('count-no-leidas')
  async countNoLeidas(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    const count = await this.notificacionesService.countNoLeidas(
      tenantId,
      user.id,
    );
    return { count };
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch(':id/leer')
  async marcarLeida(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.notificacionesService.marcarLeida(tenantId, user.id, id);
  }

  @Roles('admin', 'jefe_taller', 'mechanic')
  @HttpCode(HttpStatus.OK)
  @Patch('leer-todas')
  async marcarTodasLeidas(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificacionesService.marcarTodasLeidas(tenantId, user.id);
  }
}
