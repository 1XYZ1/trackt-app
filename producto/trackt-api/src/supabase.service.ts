import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;
  private adminClient: SupabaseClient | null = null;

  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Cliente con service-role para operaciones administrativas
   * (crear signed URLs, bypass de RLS en Storage, etc).
   * Lazy: solo se instancia cuando se pide.
   */
  getAdminClient(): SupabaseClient {
    if (!this.adminClient) {
      const url = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !serviceKey) {
        throw new Error(
          'SUPABASE_SERVICE_ROLE_KEY o SUPABASE_URL no configurada',
        );
      }
      this.adminClient = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    return this.adminClient;
  }
}
