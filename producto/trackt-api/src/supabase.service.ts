import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

// Tipo derivado de createClient: evita el choque de genéricos entre
// versiones de SupabaseClient (el default del tipo y el del factory
// difieren en supabase-js v2).
type Supabase = ReturnType<typeof createClient>;

@Injectable()
export class SupabaseService {
  private client: Supabase;
  private adminClient: Supabase | null = null;

  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );
  }

  getClient(): Supabase {
    return this.client;
  }

  /**
   * Cliente con service-role para operaciones administrativas
   * (crear signed URLs, bypass de RLS en Storage, etc).
   * Lazy: solo se instancia cuando se pide.
   */
  getAdminClient(): Supabase {
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
