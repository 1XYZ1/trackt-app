import { ProgramacionMantenimientoEstado } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListProgramacionesQueryDto extends PaginationQueryDto {
  // Rango de fechas sobre fechaProgramada (ambos inclusivos).
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  equipoId?: string;

  @IsOptional()
  @IsEnum(ProgramacionMantenimientoEstado)
  estado?: ProgramacionMantenimientoEstado;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  responsableId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  plantillaId?: string;
}
