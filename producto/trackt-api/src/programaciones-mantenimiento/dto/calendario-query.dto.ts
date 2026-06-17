import { IsDateString } from 'class-validator';

// Vista calendario: el rango es obligatorio (el frontend siempre consulta
// el mes/semana visible) y acotado para no volcar la tabla completa.
export class CalendarioQueryDto {
  @IsDateString()
  desde!: string;

  @IsDateString()
  hasta!: string;
}
