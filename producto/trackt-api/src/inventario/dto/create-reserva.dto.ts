import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReservaItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  repuestoId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CreateReservaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReservaItemDto)
  items!: ReservaItemDto[];
}
