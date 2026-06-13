import { Prioridad } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateProgramacionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  equipoId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  plantillaId?: string;

  // Opcional si hay plantilla: se usa el nombre de la plantilla como título.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsDateString()
  fechaProgramada!: string;

  // auth.users.id del responsable (cualquier rol del tenant).
  @IsOptional()
  @IsUUID()
  responsableId?: string;

  @IsOptional()
  @IsEnum(Prioridad)
  prioridad?: Prioridad;

  // Texto libre ("mensual", "cada 500 horas"); se materializa al generar
  // la siguiente ocurrencia en Fase 5.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  recurrencia?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
