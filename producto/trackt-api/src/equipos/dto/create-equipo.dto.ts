import { EquipoEstadoOperativo } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateEquipoDto {
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
  @MaxLength(60)
  tipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  marca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  modelo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  numeroSerie?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ubicacion?: string;

  @IsOptional()
  @IsEnum(EquipoEstadoOperativo)
  estadoOperativo?: EquipoEstadoOperativo;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaInstalacion?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fechaCompra?: Date;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
