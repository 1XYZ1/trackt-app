import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class HistorialQueryDto {
  // Rango sobre la fecha de creación (fechaProgramada en programaciones).
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  // Se aplica a cada colección cuyo enum contenga el valor (ej. PENDIENTE
  // filtra OTs y tickets; PROGRAMADA solo programaciones). 400 si el valor
  // no existe en ningún enum.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  estado?: string;
}
