import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthUser } from '../../auth/types';

export type { AuthUser };

@Injectable()
export class TenantService {
  resolveTenantId(user: AuthUser): string {
    if (!user?.tenantId) {
      throw new UnauthorizedException('Usuario sin tenant asociado');
    }
    return user.tenantId;
  }
}
