import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { SupabaseService } from '../supabase.service';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService, SupabaseService, AuthGuard],
})
export class UsuariosModule {}
