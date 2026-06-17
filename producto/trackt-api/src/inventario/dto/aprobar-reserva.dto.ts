import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body opcional para aprobar una reserva SOLICITADA → RESERVADA.
 * La observacion queda registrada en el movimiento RESERVA emitido durante
 * la aprobacion para auditoria.
 */
export class AprobarReservaDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  observacion?: string;
}
