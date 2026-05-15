import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseService } from './supabase.service';
import { AuthGuard } from './auth/auth.guard';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './common/tenant/tenant.module';
import { EquiposModule } from './equipos/equipos.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { OrdenesModule } from './ordenes/ordenes.module';

@Module({
  imports: [
    PrismaModule,   // @Global — PrismaService disponible en toda la app
    TenantModule,   // @Global — TenantService disponible en toda la app
    EquiposModule,
    UsuariosModule,
    OrdenesModule,
  ],
  controllers: [AppController],
  providers: [AppService, SupabaseService, AuthGuard],
})
export class AppModule {}
