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
      description="Ingresa tu correo y enviaremos las instrucciones."
      eyebrow="Recuperacion"
      footer={
        <Link className="text-cyan-300 transition hover:text-cyan-200" href="/login">
          Volver al inicio de sesion
        </Link>
      }
      title="Recuperar contrasena"
    >
      {message && !error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3.5 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
          <p className="text-cyan-50 text-sm">{message}</p>
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/10 px-3.5 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-sm text-destructive">
              No se pudo enviar el enlace
            </p>
            <p className="mt-0.5 text-muted-foreground text-xs">{error}</p>
          </div>
        </div>
      )}

      <ForgotForm />
    </AuthShell>
  );
}
