import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseService } from './supabase.service';
import { AuthGuard } from './auth/auth.guard';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AppController],
  providers: [AppService, SupabaseService, AuthGuard],
})
export class AppModule {}
