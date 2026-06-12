import { Module } from '@nestjs/common';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';
import { EquiposRepuestosController } from './equipos-repuestos.controller';
import { EquiposRepuestosService } from './equipos-repuestos.service';

@Module({
  controllers: [EquiposController, EquiposRepuestosController],
  providers: [EquiposService, EquiposRepuestosService],
})
export class EquiposModule {}
