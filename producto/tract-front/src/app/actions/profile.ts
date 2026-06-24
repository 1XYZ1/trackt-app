'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
type AllowedMime = (typeof ALLOWED_MIME)[number];

const MIME_TO_EXT: Record<AllowedMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'Requerido').max(120, 'Maximo 120'),
});

const passwordSchema = z
  .object({
    password: z.string().min(8, 'Minimo 8 caracteres').max(72, 'Maximo 72'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    path: ['confirm'],
    message: 'Las contrasenas no coinciden',
  });

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type UploadAvatarResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const session = await requireSession();

  const parsed = profileSchema.safeParse({
    fullName: formData.get('fullName'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Datos invalidos',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName })
    .eq('id', session.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  // Sincronizar al user_metadata de auth (best-effort): la fuente de verdad es
  // la tabla profiles, esto solo mantiene el JWT/metadata consistente. No es
  // fatal si falla, por eso no se propaga el error.
  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } });

  revalidatePath('/configuracion/perfil');
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function uploadAvatar(
  formData: FormData,
): Promise<UploadAvatarResult> {
  const session = await requireSession();

  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Archivo invalido' };
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return { ok: false, error: 'El archivo supera 2 MB' };
  }
  if (!ALLOWED_MIME.includes(file.type as AllowedMime)) {
    return { ok: false, error: 'Formato no permitido (PNG, JPG o WEBP)' };
  }

  const ext = MIME_TO_EXT[file.type as AllowedMime];
  const path = `${session.id}/avatar.${ext}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  // Sin fallback a service_role: subir con el cliente admin saltaria las RLS
  // del bucket y ocultaria una mala configuracion de policies. Propagar el error.
  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: publicData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(path);

  const publicUrl = `${publicData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', session.id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Sincronizar al user_metadata de auth (best-effort, ver nota en updateProfile).
  await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });

  revalidatePath('/configuracion/perfil');
  revalidatePath('/', 'layout');
  return { ok: true, url: publicUrl };
}

export async function updatePassword(
  formData: FormData,
): Promise<ActionResult> {
  // Exige sesion valida; updateUser opera sobre el usuario autenticado del
  // cliente server-side, nunca se recibe un id de usuario desde el cliente.
  await requireSession();

  const parsed = passwordSchema.safeParse({
    password: formData.get('password'),
    confirm: formData.get('confirm'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Datos invalidos',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
