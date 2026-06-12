import { Module } from '@nestjs/common';
import { ProgramacionesMantenimientoController } from './programaciones-mantenimiento.controller';
import { ProgramacionesMantenimientoService } from './programaciones-mantenimiento.service';

@Module({
  controllers: [ProgramacionesMantenimientoController],
  providers: [ProgramacionesMantenimientoService],
  exports: [ProgramacionesMantenimientoService],
})
export class ProgramacionesMantenimientoModule {}
