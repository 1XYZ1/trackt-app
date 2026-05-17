import { OrdenTrabajoEstado } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListOrdenesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(OrdenTrabajoEstado)
  estado?: OrdenTrabajoEstado;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  equipoId?: string;
}
