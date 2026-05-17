import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AsignarTicketDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  mecanicoId!: string;
}
