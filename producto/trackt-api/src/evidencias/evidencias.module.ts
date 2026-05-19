import { Module } from '@nestjs/common';
import { EvidenciasController } from './evidencias.controller';
import { EvidenciasService } from './evidencias.service';
import { SupabaseService } from '../supabase.service';

@Module({
  controllers: [EvidenciasController],
  providers: [EvidenciasService, SupabaseService],
  exports: [EvidenciasService],
})
export class EvidenciasModule {}
