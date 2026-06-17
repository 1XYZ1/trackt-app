import { Module } from '@nestjs/common';
import { EquiposModule } from '../equipos/equipos.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [EquiposModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
