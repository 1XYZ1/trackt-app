import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { EquiposService } from './equipos.service';
import { ListEquiposQueryDto } from './dto/list-equipos-query.dto';
import { TenantService, AuthUser } from '../common/tenant/tenant.service';

interface RequestWithUser extends Request {
  user: AuthUser;
}

/**
 * GET /equipos          → lista paginada (protegida, scoped por tenant)
 * GET /equipos/:id      → detalle (404 si no existe o es de otro tenant)
 */
@UseGuards(AuthGuard)
@Controller('equipos')
export class EquiposController {
  constructor(
    private readonly equiposService: EquiposService,
    private readonly tenantService: TenantService,
  ) {}

  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListEquiposQueryDto,
  ) {
    const tenantId = await this.tenantService.resolveTenantId(req.user);
    return this.equiposService.findAll(tenantId, query);
  }

  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = await this.tenantService.resolveTenantId(req.user);
    return this.equiposService.findOne(tenantId, id);
  }
}
