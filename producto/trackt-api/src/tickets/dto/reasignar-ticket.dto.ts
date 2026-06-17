import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReasignarTicketDto {
  // UUID de profiles (auth.users); el service lo castea a ::uuid.
  @IsUUID()
  mecanicoId!: string;

  // Opcional a nivel DTO. El service lo valida como obligatorio cuando el
  // ticket está EN_EJECUCION (regla de negocio, no de forma).
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
