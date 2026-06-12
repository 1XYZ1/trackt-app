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

  // Referencia al catálogo de marcas (ámbito REPUESTO o AMBOS).
  // IsNotEmpty: '' es falsy y esquivaría assertMarcaUsable en el service,
  // terminando en una violación FK genérica en vez de un 404 claro.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  marcaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  codigoFabricante?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ubicacionBodega?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  proveedor?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
