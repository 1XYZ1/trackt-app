import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { EquiposModule } from './equipos/equipos.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { OrdenesModule } from './ordenes/ordenes.module';
import { TicketsModule } from './tickets/tickets.module';
import { EvidenciasModule } from './evidencias/evidencias.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { InventarioModule } from './inventario/inventario.module';
import { MarcasModule } from './marcas/marcas.module';
import { PlantillasMantenimientoModule } from './plantillas-mantenimiento/plantillas-mantenimiento.module';
import { ProgramacionesMantenimientoModule } from './programaciones-mantenimiento/programaciones-mantenimiento.module';
import { ReportesModule } from './reportes/reportes.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EquiposModule,
    UsuariosModule,
    OrdenesModule,
    TicketsModule,
    EvidenciasModule,
    NotificacionesModule,
    InventarioModule,
    MarcasModule,
    PlantillasMantenimientoModule,
    ProgramacionesMantenimientoModule,
    ReportesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
