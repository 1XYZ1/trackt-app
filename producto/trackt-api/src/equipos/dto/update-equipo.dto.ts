import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateEquipoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  codigo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  // marca / modelo / ubicacion aceptan null para permitir limpiar el campo
  // desde el form. undefined = no tocar; null = setear a null en BD.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(60)
  marca?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(60)
  modelo?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  ubicacion?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
