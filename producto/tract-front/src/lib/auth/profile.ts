import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export type UserRole =
  | 'admin'
  | 'jefe_taller'
  | 'jefe_inventario'
  | 'mechanic';

export interface SessionProfile {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  fullName: string | null;
  avatarUrl: string | null;
}

// cache() memoiza por request: layout y página(s) comparten un solo getUser() +
// query a profiles en el mismo render, en vez de repetir el round-trip por cada
// requireSession/requireRole. El scope es por-request, no filtra entre usuarios.
export const getSessionProfile = cache(
  async (): Promise<SessionProfile | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, role, tenant_id, full_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (error || !profile) return null;

    return {
      id: profile.id,
      email: user.email ?? '',
      role: profile.role as UserRole,
      tenantId: profile.tenant_id,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
    };
  },
);
