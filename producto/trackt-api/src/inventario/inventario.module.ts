import { Module } from '@nestjs/common';
import { InventarioController } from './inventario.controller';
import { ReservasRepuestosController } from './reservas-repuestos.controller';
import { InventarioService } from './inventario.service';

@Module({
  controllers: [InventarioController, ReservasRepuestosController],
  providers: [InventarioService],
  exports: [InventarioService],
})
export class InventarioModule {}
