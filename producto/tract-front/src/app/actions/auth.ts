'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '../../lib/supabase/server';

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect('/dashboard');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

const forgotSchema = z.object({
  email: z.string().email('Correo invalido'),
});

async function resolveOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

export async function forgotPassword(formData: FormData) {
  const parsed = forgotSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Datos invalidos';
    redirect(`/forgot-password?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createClient();
  const origin = await resolveOrigin();
  const redirectTo = `${origin}/auth/callback?next=/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo },
  );

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }
  redirect(
    `/forgot-password?message=${encodeURIComponent(
      'Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo.',
    )}`,
  );
}

const resetSchema = z
  .object({
    password: z.string().min(8, 'Minimo 8 caracteres'),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Las contraseñas no coinciden',
    path: ['passwordConfirm'],
  });

export async function resetPassword(formData: FormData) {
  const parsed = resetSchema.safeParse({
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Datos invalidos';
    redirect(`/reset-password?error=${encodeURIComponent(msg)}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/login?error=${encodeURIComponent(
        'Sesion de recuperacion invalida o expirada',
      )}`,
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect(
    `/login?message=${encodeURIComponent(
      'Contraseña actualizada. Inicia sesion con la nueva clave.',
    )}`,
  );
}
