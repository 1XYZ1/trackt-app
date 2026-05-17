import { TicketEstado } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListTicketsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TicketEstado)
  estado?: TicketEstado;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  mecanicoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  otId?: string;
}
