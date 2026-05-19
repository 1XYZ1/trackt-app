import { Global, Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';

/**
 * @Global() para inyectar NotificacionesService en cualquier otro módulo
 * (tickets, ordenes, etc.) sin requerir forwardRef ni imports explícitos.
 * Evita ciclos con tickets/ordenes que ya tienen forwardRef entre sí.
 */
@Global()
@Module({
  controllers: [NotificacionesController],
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
