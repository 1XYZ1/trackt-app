import { Module } from '@nestjs/common';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';

@Module({
  controllers: [EquiposController],
  providers: [EquiposService],
})
export class EquiposModule {}
