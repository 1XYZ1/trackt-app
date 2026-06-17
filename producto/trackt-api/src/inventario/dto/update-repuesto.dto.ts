import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateRepuestoDto {
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

  // descripcion / categoria aceptan null para permitir limpiar el campo desde
  // el form. undefined = no tocar; null = setear a null en BD.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  descripcion?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(60)
  categoria?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unidad?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockMinimo?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // marcaId / codigoFabricante / ubicacionBodega / proveedor aceptan null
  // para limpiar el campo. undefined = no tocar.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(60)
  marcaId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(80)
  codigoFabricante?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  ubicacionBodega?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  proveedor?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
