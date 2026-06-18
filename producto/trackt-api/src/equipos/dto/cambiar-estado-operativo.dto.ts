import { EquipoEstadoOperativo } from '@prisma/client';
import { IsEnum } from 'class-validator';

/**
 * Cambio acotado del estado operativo del equipo (página QR mobile).
 * No reutiliza UpdateEquipoDto a propósito: este endpoint lo pueden usar
 * mecánico/jefe en terreno y solo debe permitir tocar este campo.
 */
export class CambiarEstadoOperativoDto {
  @IsEnum(EquipoEstadoOperativo)
  estadoOperativo!: EquipoEstadoOperativo;
}
