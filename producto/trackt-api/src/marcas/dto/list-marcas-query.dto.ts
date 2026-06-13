import { MarcaTipo } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListMarcasQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  // Ámbito: tipo=EQUIPO devuelve marcas EQUIPO y AMBOS; tipo=REPUESTO
  // devuelve REPUESTO y AMBOS (las AMBOS sirven en los dos formularios).
  @IsOptional()
  @IsEnum(MarcaTipo)
  tipo?: MarcaTipo;

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
