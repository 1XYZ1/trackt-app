import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './common/tenant/tenant.module';
import { EquiposModule } from './equipos/equipos.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { OrdenesModule } from './ordenes/ordenes.module';
import { TicketsModule } from './tickets/tickets.module';
import { EvidenciasModule } from './evidencias/evidencias.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { InventarioModule } from './inventario/inventario.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenantModule,
    EquiposModule,
    UsuariosModule,
    OrdenesModule,
    TicketsModule,
    EvidenciasModule,
    NotificacionesModule,
    InventarioModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
