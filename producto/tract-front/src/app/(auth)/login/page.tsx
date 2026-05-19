import { Activity, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { LoginForm } from './login-form';

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, message } = await searchParams;
  const errorMessage = error ? normalizeAuthError(error) : null;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,13,20,0.25),rgba(8,13,20,0.92))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <section className="hidden lg:block">
          <Badge className="mb-5 w-fit border-cyan-400/30 text-cyan-100" variant="outline">
            <ShieldCheck />
            Acceso operacional seguro
          </Badge>
          <h1 className="max-w-xl font-semibold text-4xl tracking-tight">
            Control de mantenimiento para operacion industrial.
          </h1>
          <p className="mt-4 max-w-lg text-muted-foreground text-sm leading-6">
            Ingresa al panel TRACKT para revisar ordenes, tickets, evidencias
            y validaciones del taller en un flujo centralizado.
          </p>

          <div className="mt-8 grid max-w-lg gap-3">
            {[
              'Trazabilidad de tickets y ordenes de trabajo.',
              'Validacion de evidencias y cierre operacional.',
              'Vista por rol para jefe de taller y mecanicos.',
            ].map((item) => (
              <div
                className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/70 px-4 py-3 text-sm shadow-xs"
                key={item}
              >
                <CheckCircle2 className="size-4 shrink-0 text-cyan-300" />
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-6 flex flex-col items-center lg:items-start">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-400/25 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
                <Activity className="h-5 w-5 text-cyan-200" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="font-semibold text-2xl tracking-tight">
                  Trackt
                </h2>
                <p className="text-muted-foreground text-xs">
                  SaaS industrial de mantenimiento
                </p>
              </div>
            </div>
          </div>

          <Card className="rounded-lg border-border/70 bg-card/95 shadow-[0_18px_60px_rgba(0,0,0,0.35),0_0_0_1px_rgba(34,211,238,0.04)] backdrop-blur">
            <CardContent className="p-6 sm:p-7">
              <div className="mb-6">
                <p className="font-medium text-[11px] text-cyan-200 uppercase tracking-[0.18em]">
                  Ingreso al sistema
                </p>
                <h1 className="mt-2 font-semibold text-xl tracking-tight">
                  Bienvenido de nuevo
                </h1>
                <p className="mt-1 text-muted-foreground text-sm">
                  Usa tus credenciales asignadas para acceder al panel TRACKT.
                </p>
              </div>

              {message && !error && (
                <div className="mb-5 flex items-start gap-3 rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3.5 py-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                  <p className="text-cyan-50 text-sm">{message}</p>
                </div>
              )}

              {errorMessage && (
                <div className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/10 px-3.5 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium text-sm text-destructive">
                      No se pudo iniciar sesion
                    </p>
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              )}

              <LoginForm />
            </CardContent>

            <div className="border-border/70 border-t px-6 py-4 sm:px-7">
              <div className="flex items-center justify-center gap-2 text-center text-muted-foreground text-xs">
                <ShieldCheck className="size-3.5" />
                Acceso restringido al personal autorizado.
              </div>
            </div>
          </Card>

          <p className="mt-5 text-center text-muted-foreground text-xs lg:text-left">
            Copyright {new Date().getFullYear()} Trackt. Operacion minera e
            industrial.
          </p>
        </section>
      </div>
    </div>
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

  return error;
}
