import { Module } from '@nestjs/common';
import { OrdenesModule } from '../ordenes/ordenes.module';
import { TicketsModule } from '../tickets/tickets.module';
import { InventarioModule } from '../inventario/inventario.module';
import { ProgramacionesMantenimientoController } from './programaciones-mantenimiento.controller';
import { ProgramacionesMantenimientoService } from './programaciones-mantenimiento.service';

@Module({
  imports: [OrdenesModule, TicketsModule, InventarioModule],
  controllers: [ProgramacionesMantenimientoController],
  providers: [ProgramacionesMantenimientoService],
  exports: [ProgramacionesMantenimientoService],
})
export class ProgramacionesMantenimientoModule {}
