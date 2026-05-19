import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateEquipoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  codigo?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  marca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  modelo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ubicacion?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
