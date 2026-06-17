import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

// Ajuste sobre un insumo de la plantilla: cantidad 0 lo excluye de la
// reserva; > 0 reemplaza la cantidad sugerida.
export class AjustarItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  repuestoId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  cantidad!: number;
}

export class GenerarOtDto {
  // AUTOMATICA (default): crea la reserva con los insumos de la plantilla.
  // SUGERIDA: genera OT/ticket pero NO reserva — devuelve itemsSugeridos
  // para que el usuario cree la reserva ajustada via
  // POST /tickets/:ticketId/reservas-repuestos (endpoints existentes).
  @IsOptional()
  @IsIn(['AUTOMATICA', 'SUGERIDA'])
  modoReserva?: 'AUTOMATICA' | 'SUGERIDA';

  // Solo válido si la programación tiene plantilla; cada repuestoId debe
  // pertenecer a los items de la plantilla.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AjustarItemDto)
  ajustarItems?: AjustarItemDto[];

  // Observación para la reserva generada.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;
}
