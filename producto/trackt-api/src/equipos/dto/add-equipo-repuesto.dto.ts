import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AddEquipoRepuestoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  repuestoId!: string;

  // Cantidad de referencia que típicamente consume una mantención.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidadRef?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacion?: string;
}
