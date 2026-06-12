import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListPlantillasQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  // Filtra plantillas aplicables a un tipo de equipo.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tipoEquipo?: string;

  // Acepta 'true'/'false' como string (querystring) o boolean.
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return undefined;
  })
  @IsBoolean()
  includeInactive?: boolean;
}
