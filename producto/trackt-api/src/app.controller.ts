import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { SupabaseService } from './supabase.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthUser } from './auth/types';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get()
  getHello(): { message: string } {
    return this.appService.getHello();
  }

  @Get('hola')
  getHola(): { message: string } {
    return { message: 'hola mundo' };
  }

  @Get('messages')
  async getMessages() {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { error: error.message };
    }
    return data;
  }

  @UseGuards(AuthGuard)
  @Get('me')
  getMe(@Req() req: { user: AuthUser }) {
    return {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      tenantId: req.user.tenantId,
      fullName: req.user.fullName,
    };
  }
}
