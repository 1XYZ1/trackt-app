import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdatePlantillaDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombre?: string;

  // String vacío limpia el campo (se normaliza a null en el service).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipoEquipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  frecuencia?: string;

  // Permite reactivar una plantilla desactivada (activo: true).
  // Para desactivar existe PATCH /plantillas-mantenimiento/:id/desactivar.
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // null limpia metadata completa (columna a NULL, incluye el checklist).
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown> | null;
}
