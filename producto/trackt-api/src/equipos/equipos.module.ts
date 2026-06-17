import { Module } from '@nestjs/common';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';
import { EquiposRepuestosController } from './equipos-repuestos.controller';
import { EquiposRepuestosService } from './equipos-repuestos.service';
import { EquiposPlantillasController } from './equipos-plantillas.controller';
import { EquiposPlantillasService } from './equipos-plantillas.service';

@Module({
  controllers: [
    EquiposController,
    EquiposRepuestosController,
    EquiposPlantillasController,
  ],
  providers: [
    EquiposService,
    EquiposRepuestosService,
    EquiposPlantillasService,
  ],
})
export class EquiposModule {}
