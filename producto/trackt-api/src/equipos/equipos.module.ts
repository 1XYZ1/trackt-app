import { Module } from '@nestjs/common';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';
import { SupabaseService } from '../supabase.service';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  controllers: [EquiposController],
  providers: [EquiposService, SupabaseService, AuthGuard],
})
export class EquiposModule {}
