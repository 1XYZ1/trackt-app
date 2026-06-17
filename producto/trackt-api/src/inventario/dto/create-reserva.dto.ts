import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReservaItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  repuestoId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
}

export class CreateReservaDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacion?: string;

  // Si true Y el usuario es mechanic: crea la reserva en estado SOLICITADA
  // (sin aplicar stockReservado). Requiere aprobacion posterior de admin/jefe
  // via POST /reservas-repuestos/:id/aprobar.
  // Para admin/jefe el campo se ignora (crean RESERVADA directo).
  @IsOptional()
  @IsBoolean()
  solicitar?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReservaItemDto)
  items!: ReservaItemDto[];
}
