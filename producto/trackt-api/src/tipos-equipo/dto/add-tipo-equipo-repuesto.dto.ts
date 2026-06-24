import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AddTipoEquipoRepuestoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  repuestoId!: string;

  // Cantidad de referencia que típicamente consume una mantención. Se copia
  // tal cual a equipos_repuestos al crear un equipo de este tipo.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidadRef?: number;

  // obligatorio=false marca repuestos opcionales del tipo. Default true (igual
  // que el schema). No tiene columna en equipos_repuestos: solo vive acá.
  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacion?: string;
}
