import { Prioridad } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateOrdenDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  descripcion?: string;

  @IsOptional()
  @IsEnum(Prioridad)
  prioridad?: Prioridad;
}
