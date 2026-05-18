import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AsignarTicketDto {
  // El id en la DB es TEXT (cuid o uuid según el cliente que lo creó).
  // Validamos solo como string no vacio; la existencia/forma se chequea
  // en el service contra profiles.
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  mecanicoId!: string;
}
