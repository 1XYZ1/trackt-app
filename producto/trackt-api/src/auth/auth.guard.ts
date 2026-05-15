import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase.service';
import { ProfileService } from './profile.service';
import { AuthUser } from './types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly profiles: ProfileService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization as string | undefined;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    const { data, error } = await this.supabase.getClient().auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid token');
    }

    const profile = await this.profiles.getById(data.user.id);
    if (!profile) {
      throw new UnauthorizedException('Profile not found');
    }

    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      role: profile.role,
      tenantId: profile.tenant_id,
      fullName: profile.full_name,
      app_metadata: data.user.app_metadata,
      user_metadata: data.user.user_metadata,
    };

    req.user = authUser;
    return true;
  }
}
