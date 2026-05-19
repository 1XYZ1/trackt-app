import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CerrarTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacion?: string;
}
