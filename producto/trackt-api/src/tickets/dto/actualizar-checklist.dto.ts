import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Límite alineado con CHECKLIST_MAX_PASOS de plantillas-mantenimiento: el
// checklist del ticket nace de una plantilla, así que no debería excederlo.
const CHECKLIST_MAX_PASOS = 100;
const CHECKLIST_MAX_LARGO_PASO = 500;

// Un paso del checklist del ticket: el texto (paso) + si está hecho. Se
// reemplaza el checklist completo (no PATCH por índice) para que el frontend
// envíe el estado actual tal cual lo ve el mecánico.
export class ChecklistPasoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(CHECKLIST_MAX_LARGO_PASO)
  paso!: string;

  @IsBoolean()
  hecho!: boolean;
}

export class ActualizarChecklistDto {
  @IsArray()
  @ArrayMaxSize(CHECKLIST_MAX_PASOS)
  @ValidateNested({ each: true })
  @Type(() => ChecklistPasoDto)
  checklist!: ChecklistPasoDto[];
}
