import { Activity, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { LoginForm } from './login-form';

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;
  const errorMessage = error ? normalizeAuthError(error) : null;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0d0d0d] px-4 py-10 text-neutral-100">
      <section className="w-full max-w-md">
          <div className="mb-6 flex flex-col items-center">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand-primary/25 bg-brand-primary/10 shadow-[0_0_24px_rgba(97,82,232,0.18)]">
                <Activity className="h-5 w-5 text-brand-300" strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <h2 className="font-semibold text-2xl tracking-tight">
                  Trackt
                </h2>
                <p className="text-neutral-500 text-xs">
                  SaaS industrial de mantenimiento
                </p>
              </div>
            </div>
          </div>

          <Card className="rounded-lg border-white/10 bg-[#171717] shadow-[0_18px_60px_rgba(0,0,0,0.38)]">
            <CardContent className="p-6 sm:p-7">
              <div className="mb-6">
                <p className="font-semibold text-[11px] text-brand-300 uppercase tracking-[0.18em]">
                  Ingreso al sistema
                </p>
                <h2 className="mt-2 font-semibold text-xl text-neutral-100 tracking-tight">
                  Bienvenido de nuevo
                </h2>
                <p className="mt-1 text-neutral-500 text-sm">
                  Usa tus credenciales asignadas para acceder al panel TRACKT.
                </p>
              </div>

              {message && !error && (
                <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <p className="text-emerald-50 text-sm">{message}</p>
                </div>
              )}

              {errorMessage && (
                <div className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/10 px-3.5 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium text-sm text-destructive">
                      No se pudo iniciar sesión
                    </p>
                    <p className="mt-0.5 text-neutral-400 text-xs">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}

              <LoginForm />
            </CardContent>

            <div className="border-border/70 border-t px-6 py-4 sm:px-7">
              <div className="flex items-center justify-center gap-2 text-center text-neutral-500 text-xs">
                <ShieldCheck className="size-3.5" />
                Acceso restringido al personal autorizado.
              </div>
            </div>
          </Card>

          <p className="mt-5 text-center text-neutral-600 text-xs">
            Copyright {new Date().getFullYear()} Trackt. Operación minera e
            industrial.
          </p>
        </section>
    </div>
  );
}

function normalizeAuthError(error: string) {
  const normalized = error.toLowerCase();

  if (
    normalized.includes('invalid login') ||
    normalized.includes('invalid credentials')
  ) {
    return 'Correo o contraseña incorrectos. Revisa los datos e intenta nuevamente.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'El correo aún no está confirmado. Revisa tu bandeja de entrada.';
  }

  return 'No se pudo iniciar sesión. Intenta nuevamente o contacta a soporte.';
}
