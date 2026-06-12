import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthShell } from '../auth-shell';
import { ForgotForm } from './forgot-form';

type ForgotPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPageProps) {
  const { error, message } = await searchParams;

  return (
    <AuthShell
      description="Te enviaremos las instrucciones al correo registrado."
      eyebrow="Recuperacion"
      footer={
        <Link
          className="text-zinc-100 transition hover:text-white"
          href="/login"
        >
          Volver al inicio de sesion
        </Link>
      }
      title="Recuperar contraseña"
    >
      {message && !error && (
        <div className="mx-auto mb-5 flex max-w-[348px] items-start gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-3 text-left">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <p className="text-emerald-100 text-sm">{message}</p>
        </div>
      )}

      {error && (
        <div className="mx-auto mb-5 flex max-w-[348px] items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/10 px-3.5 py-3 text-left">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-sm text-destructive">
              No se pudo enviar el enlace
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">{error}</p>
          </div>
        </div>
      )}

      <ForgotForm />
    </AuthShell>
  );
}
