import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { EquiposService } from './equipos.service';
import { ListEquiposQueryDto } from './dto/list-equipos-query.dto';
import { TenantService } from '../common/tenant/tenant.service';
import { AuthUser } from '../auth/types';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'mechanic')
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
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.findAll(tenantId, query);
  }

  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.equiposService.findOne(tenantId, id);
  }
}
