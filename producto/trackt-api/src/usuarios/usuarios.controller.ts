import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { UsuariosService } from './usuarios.service';
import { ListUsuariosQueryDto } from './dto/list-usuarios-query.dto';

@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: ListUsuariosQueryDto,
  ) {
    return this.usuariosService.findAll(tenantId, query);
  }
}
