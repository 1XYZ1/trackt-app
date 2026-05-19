import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ValidarTicketDto {
  @IsBoolean()
  aprobado!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacion?: string;
}
