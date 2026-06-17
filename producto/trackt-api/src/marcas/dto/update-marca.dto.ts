import { MarcaTipo } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateMarcaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsEnum(MarcaTipo)
  tipo?: MarcaTipo;

  // Permite reactivar una marca desactivada (activo: true).
  // Para desactivar existe PATCH /marcas/:id/desactivar.
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
