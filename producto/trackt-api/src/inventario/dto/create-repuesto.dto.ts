import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRepuestoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoria?: string;

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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockInicial?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
