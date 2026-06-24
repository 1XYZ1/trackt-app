import { Module } from '@nestjs/common';
import { PlantillasMantenimientoController } from './plantillas-mantenimiento.controller';
import { PlantillasMantenimientoService } from './plantillas-mantenimiento.service';
import { PlantillasAplicacionService } from './plantillas-aplicacion.service';

@Module({
  controllers: [PlantillasMantenimientoController],
  providers: [PlantillasMantenimientoService, PlantillasAplicacionService],
  exports: [PlantillasMantenimientoService, PlantillasAplicacionService],
})
export class PlantillasMantenimientoModule {}
