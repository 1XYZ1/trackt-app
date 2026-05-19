import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class AjusteStockDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  nuevoStockActual!: number;

  // Obligatoria para auditoría: cualquier ajuste necesita justificación.
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  observacion!: string;
}
