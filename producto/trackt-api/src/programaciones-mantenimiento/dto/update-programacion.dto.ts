import { Prioridad } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// Solo programaciones en estado PROGRAMADA son editables. El estado no se
// cambia por PATCH: cancelar tiene endpoint propio y GENERADA/VENCIDA/
// COMPLETADA las setea la Fase 5. equipoId tampoco cambia: si el equipo
// está mal, se cancela y se crea otra programación.
export class UpdateProgramacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  titulo?: string;

  // String vacío limpia el campo (se normaliza a null en el service).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  // null desvincula la plantilla.
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  plantillaId?: string | null;

  @IsOptional()
  @IsDateString()
  fechaProgramada?: string;

  // null quita el responsable.
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  responsableId?: string | null;

  @IsOptional()
  @IsEnum(Prioridad)
  prioridad?: Prioridad;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  recurrencia?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
