import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './common/tenant/tenant.module';
import { EquiposModule } from './equipos/equipos.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { OrdenesModule } from './ordenes/ordenes.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenantModule,
    EquiposModule,
    UsuariosModule,
    OrdenesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
