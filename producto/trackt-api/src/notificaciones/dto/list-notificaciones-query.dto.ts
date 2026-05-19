import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { NotificacionTipo } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListNotificacionesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(NotificacionTipo)
  tipo?: NotificacionTipo;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  soloNoLeidas?: boolean;
}
