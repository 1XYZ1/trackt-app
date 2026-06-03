'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/require-role';

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(120),
  // Solo admin invita (verificado por requireRole abajo). admin puede crear
  // cualquier rol; jefe_taller no llega a este flujo.
  role: z.enum(['admin', 'jefe_taller', 'mechanic']),
});

export type InviteUserResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function inviteUser(formData: FormData): Promise<InviteUserResult> {
  const session = await requireRole('admin');

  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    fullName: formData.get('fullName'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalido' };
  }
  const { email, fullName, role } = parsed.data;

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });

  if (error || !data.user) {
    return { ok: false, error: error?.message ?? 'No se pudo invitar' };
  }

  // Crear/asegurar el profile con upsert (idempotente): no dependemos de un
  // trigger handle_new_user (no existe en esta DB), que dejaria al invitado sin
  // profile y sin poder loguear. Si falla, compensamos borrando el auth user.
  const { error: upsertError } = await admin
    .from('profiles')
    .upsert(
      {
        id: data.user.id,
        role,
        tenant_id: session.tenantId,
        full_name: fullName,
      },
      { onConflict: 'id' },
    );

  if (upsertError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return {
      ok: false,
      error: `No se pudo crear el perfil del invitado: ${upsertError.message}`,
    };
  }

  revalidatePath('/usuarios');
  return { ok: true, userId: data.user.id };
}
