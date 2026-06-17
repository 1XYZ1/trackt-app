import {
  OrdenTrabajoEstado,
  ProgramacionMantenimientoEstado,
  TicketEstado,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// formato=json (default) | csv. xlsx/pdf quedaron fuera a propósito: CSV
// abre en Excel y el único PDF con layout real es el de la OT.
export class ReporteBaseQueryDto {
  @IsOptional()
  @IsIn(['json', 'csv'])
  formato?: 'json' | 'csv';
}

export class ReporteOrdenesQueryDto extends ReporteBaseQueryDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsEnum(OrdenTrabajoEstado)
  estado?: OrdenTrabajoEstado;
}

export class ReporteTicketsQueryDto extends ReporteBaseQueryDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsEnum(TicketEstado)
  estado?: TicketEstado;

  // Filtra por mecánico asignado (reporte "tickets por mecánico").
  @IsOptional()
  @IsString()
  @MaxLength(60)
  mecanicoId?: string;
}

export class ReporteInventarioQueryDto extends ReporteBaseQueryDto {
  // stock (default): existencias y críticos. consumos: agregado de
  // movimientos CONSUMO por repuesto ("repuestos más consumidos").
  @IsOptional()
  @IsIn(['stock', 'consumos'])
  vista?: 'stock' | 'consumos';

  // vista=stock: solo repuestos con disponible <= stockMinimo.
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return undefined;
  })
  @IsBoolean()
  soloCriticos?: boolean;

  // vista=consumos: acota el agregado a un equipo (consumo por equipo).
  @IsOptional()
  @IsString()
  @MaxLength(60)
  equipoId?: string;

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;
}

export class ReporteMantenimientosQueryDto extends ReporteBaseQueryDto {
  // todos (default) | vencidos (PROGRAMADA con fecha pasada) |
  // proximos (PROGRAMADA con fecha futura, ascendente).
  @IsOptional()
  @IsIn(['todos', 'vencidos', 'proximos'])
  vista?: 'todos' | 'vencidos' | 'proximos';

  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsEnum(ProgramacionMantenimientoEstado)
  estado?: ProgramacionMantenimientoEstado;
}

export class ReporteHistorialQueryDto extends ReporteBaseQueryDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  estado?: string;
}
