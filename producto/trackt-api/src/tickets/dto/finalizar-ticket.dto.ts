import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FinalizarTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacion?: string;
}
