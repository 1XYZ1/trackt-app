import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuariosService } from './usuarios.service';
import { ListUsuariosQueryDto } from './dto/list-usuarios-query.dto';
import { TenantService } from '../common/tenant/tenant.service';
import { AuthUser } from '../auth/types';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
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
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.usuariosService.findAll(tenantId, query);
  }
}
