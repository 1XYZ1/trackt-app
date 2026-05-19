import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body opcional para liberar/consumir una reserva. La observación queda
 * registrada en el movimiento correspondiente para auditoría.
 */
export class ReservaActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacion?: string;
}
