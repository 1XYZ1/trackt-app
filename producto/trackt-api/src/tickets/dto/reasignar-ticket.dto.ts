import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReasignarTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  mecanicoId!: string;

  // Opcional a nivel DTO. El service lo valida como obligatorio cuando el
  // ticket está EN_EJECUCION (regla de negocio, no de forma).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
