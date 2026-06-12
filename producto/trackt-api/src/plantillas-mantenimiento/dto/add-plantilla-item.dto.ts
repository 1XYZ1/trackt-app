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

export class AddPlantillaItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  repuestoId!: string;

  // Cantidad sugerida que consume una mantención con esta plantilla.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;

  // false marca el insumo como opcional (la reserva puede omitirlo).
  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacion?: string;
}
