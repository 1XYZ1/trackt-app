import { AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { AuthShell } from '../auth-shell';
import { LoginForm } from './login-form';

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;
  const errorMessage = error ? normalizeAuthError(error) : null;

  return (
    <AuthShell
      description="Ingresa con tus credenciales asignadas."
      eyebrow="Acceso TRACKT"
      footer={
        <span className="inline-flex items-center justify-center gap-2">
          <ShieldCheck className="size-3.5" />
          Acceso restringido
        </span>
      }
      title="Iniciar sesion"
    >
      {message && !error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <p className="text-emerald-100 text-sm">{message}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/10 px-3.5 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-sm text-destructive">
              No se pudo iniciar sesion
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {errorMessage}
            </p>
          </div>
        </div>
      )}

      <LoginForm />
    </AuthShell>
  );
}

function normalizeAuthError(error: string) {
  const normalized = error.toLowerCase();

  if (
    normalized.includes('invalid login') ||
    normalized.includes('invalid credentials')
  ) {
    return 'Correo o contrasena incorrectos. Revisa los datos e intenta nuevamente.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'El correo aun no esta confirmado. Revisa tu bandeja de entrada.';
  }

  return 'No se pudo iniciar sesion. Intenta nuevamente o contacta a soporte.';
}
