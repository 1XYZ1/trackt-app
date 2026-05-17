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
import { AuthUser } from '../auth/types';
import { TenantService } from '../common/tenant/tenant.service';
import { TicketsService } from './tickets.service';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto';

interface RequestWithUser extends Request {
  user: AuthUser;
}

@UseGuards(AuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly tenantService: TenantService,
  ) {}

  @Roles('admin', 'mechanic')
  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: ListTicketsQueryDto,
  ) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ticketsService.findAll(tenantId, query);
  }

  @Roles('admin', 'mechanic')
  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    const tenantId = this.tenantService.resolveTenantId(req.user);
    return this.ticketsService.findOne(tenantId, id);
  }
}
