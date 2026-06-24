import { Module } from '@nestjs/common';
import { TiposEquipoController } from './tipos-equipo.controller';
import { TiposEquipoService } from './tipos-equipo.service';

@Module({
  controllers: [TiposEquipoController],
  providers: [TiposEquipoService],
  exports: [TiposEquipoService],
})
export class TiposEquipoModule {}
