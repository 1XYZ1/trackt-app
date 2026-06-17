import { Module, forwardRef } from '@nestjs/common';
import { OrdenesController } from './ordenes.controller';
import { OrdenesService } from './ordenes.service';
import { TicketsModule } from '../tickets/tickets.module';
import { InventarioModule } from '../inventario/inventario.module';

@Module({
  imports: [forwardRef(() => TicketsModule), InventarioModule],
  controllers: [OrdenesController],
  providers: [OrdenesService],
  exports: [OrdenesService],
})
export class OrdenesModule {}
