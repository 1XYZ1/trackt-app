import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { ProfileService } from './profile.service';
import { RolesGuard } from './roles.guard';
import { SupabaseService } from '../supabase.service';

@Global()
@Module({
  providers: [SupabaseService, ProfileService, AuthGuard, RolesGuard],
  exports: [SupabaseService, ProfileService, AuthGuard, RolesGuard],
})
export class AuthModule {}
