import { EquipoEstadoOperativo } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
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

  // Campos opcionales aceptan null para permitir limpiar el valor desde el
  // form. undefined = no tocar; null = setear a null en BD.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(60)
  tipo?: string | null;

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
  numeroSerie?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  ubicacion?: string | null;

  // estadoOperativo no acepta null: siempre debe tener un valor (default OPERATIVO).
  @IsOptional()
  @IsEnum(EquipoEstadoOperativo)
  estadoOperativo?: EquipoEstadoOperativo;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Date)
  @IsDate()
  fechaInstalacion?: Date | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Date)
  @IsDate()
  fechaCompra?: Date | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
