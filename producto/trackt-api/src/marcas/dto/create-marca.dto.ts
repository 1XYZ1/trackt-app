import { MarcaTipo } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateMarcaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre!: string;

  @IsEnum(MarcaTipo)
  tipo!: MarcaTipo;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
