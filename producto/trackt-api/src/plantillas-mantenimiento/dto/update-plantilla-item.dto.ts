import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePlantillaItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad?: number;

  @IsOptional()
  @IsBoolean()
  obligatorio?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacion?: string;
}
