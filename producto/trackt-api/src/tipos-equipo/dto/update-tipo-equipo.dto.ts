import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateTipoEquipoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre?: string;

  // null = limpiar la descripción; undefined = no tocar.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(300)
  descripcion?: string | null;

  // Permite reactivar un tipo desactivado (activo: true).
  // Para desactivar existe PATCH /tipos-equipo/:id/desactivar.
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
