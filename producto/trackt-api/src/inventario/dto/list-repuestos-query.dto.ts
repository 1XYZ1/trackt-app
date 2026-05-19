import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

function toBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return undefined;
}

export class ListRepuestosQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  categoria?: string;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  bajoStock?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  includeInactive?: boolean;
}
