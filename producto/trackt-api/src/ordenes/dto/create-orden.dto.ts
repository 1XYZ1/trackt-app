import { Prioridad } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOrdenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  equipoId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  descripcion!: string;

  @IsOptional()
  @IsEnum(Prioridad)
  prioridad?: Prioridad;

  // Plantilla de mantenimiento opcional: si llega, la OT nace con un primer
  // ticket que copia el checklist de la plantilla (metadata.checklist) y
  // reserva sus insumos. Misma "receta" que usa Programación → Generar OT.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  plantillaId?: string;
}
