import { Module } from '@nestjs/common';
import { PlantillasMantenimientoController } from './plantillas-mantenimiento.controller';
import { PlantillasMantenimientoService } from './plantillas-mantenimiento.service';

@Module({
  controllers: [PlantillasMantenimientoController],
  providers: [PlantillasMantenimientoService],
  exports: [PlantillasMantenimientoService],
})
export class PlantillasMantenimientoModule {}
