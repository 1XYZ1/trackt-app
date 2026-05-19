import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MovimientoInventarioTipo } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListMovimientosQueryDto extends PaginationQueryDto {
  // Override del default de PaginationQueryDto (10) — los movimientos son
  // historial de alta densidad, vale traer 20 por pagina por defecto.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  repuestoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ticketId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  reservaId?: string;

  @IsOptional()
  @IsEnum(MovimientoInventarioTipo)
  tipo?: MovimientoInventarioTipo;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  desde?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  hasta?: Date;
}
