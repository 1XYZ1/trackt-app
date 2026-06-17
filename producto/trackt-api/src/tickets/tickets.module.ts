import { Module, forwardRef } from '@nestjs/common';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { OrdenesModule } from '../ordenes/ordenes.module';
import { InventarioModule } from '../inventario/inventario.module';

@Module({
  imports: [forwardRef(() => OrdenesModule), InventarioModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
