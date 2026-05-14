import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { UsuariosService } from './usuarios.service';
import { ListUsuariosQueryDto } from './dto/list-usuarios-query.dto';
import { TenantService, AuthUser } from '../common/tenant/tenant.service';

interface RequestWithUser extends Request {
  user: AuthUser;
}

/**
 * GET /usuarios            → lista paginada de usuarios del tenant
 * GET /usuarios?rol=mecanico → filtra por rol (mecanico → mechanic internamente)
 */
@UseGuards(AuthGuard)
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly tenantService: TenantService,
  ) {}

  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListUsuariosQueryDto,
  ) {
    const tenantId = await this.tenantService.resolveTenantId(req.user);
    return this.usuariosService.findAll(tenantId, query);
  }
}
