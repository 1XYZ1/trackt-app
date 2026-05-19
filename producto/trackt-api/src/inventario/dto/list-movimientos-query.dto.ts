import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MovimientoInventarioTipo } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListMovimientosQueryDto extends PaginationQueryDto {
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
