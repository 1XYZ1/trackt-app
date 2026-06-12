import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePlantillaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  // Tipo de equipo al que aplica la plantilla (matchea Equipo.tipo).
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipoEquipo?: string;

  // Texto libre ("mensual", "cada 500 horas"); se formaliza en Fase 4.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  frecuencia?: string;

  // metadata.checklist: string[] con los pasos de la mantención.
  // El service valida la forma de checklist si viene presente.
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
