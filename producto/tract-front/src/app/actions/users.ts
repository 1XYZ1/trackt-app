'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth/require-role';

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(120),
  role: z.enum(['admin', 'mechanic']),
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

  // El trigger handle_new_user creo el profile con role mechanic.
  // Si admin selecciono otro role o tenant distinto, actualizo.
  const { error: updateError } = await admin
    .from('profiles')
    .update({ role, tenant_id: session.tenantId, full_name: fullName })
    .eq('id', data.user.id);

  if (updateError) {
    return { ok: false, error: `User invitado pero profile fallo: ${updateError.message}` };
  }

  revalidatePath('/usuarios');
  return { ok: true, userId: data.user.id };
}
