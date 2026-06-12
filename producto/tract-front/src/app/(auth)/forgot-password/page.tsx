import Link from 'next/link';
import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ForgotForm } from './forgot-form';

type ForgotPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPageProps) {
  const { error, message } = await searchParams;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#0d0d0d] px-4 py-10 text-neutral-100">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-brand-primary/25 bg-brand-primary/10 shadow-[0_0_24px_rgba(97,82,232,0.18)]">
              <Activity className="h-5 w-5 text-brand-300" strokeWidth={2.5} />
            </div>
            <div className="text-left">
              <h1 className="font-semibold text-2xl tracking-tight">Trackt</h1>
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
                Recuperacion de acceso
              </p>
              <h2 className="mt-2 font-semibold text-neutral-100 text-xl tracking-tight">
                Recuperar contraseña
              </h2>
              <p className="mt-1 text-neutral-500 text-sm">
                Ingresa tu correo y te enviaremos un enlace para crear una
                nueva contraseña.
              </p>
            </div>

            {message && !error && (
              <div className="mb-5 flex items-start gap-3 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <p className="text-emerald-50 text-sm">{message}</p>
              </div>
            )}

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/10 px-3.5 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="font-medium text-destructive text-sm">
                    No se pudo enviar el enlace
                  </p>
                  <p className="mt-0.5 text-neutral-400 text-xs">{error}</p>
                </div>
              </div>
            )}

            <ForgotForm />
          </CardContent>

          <div className="border-border/70 border-t px-6 py-4 sm:px-7">
            <p className="text-center text-neutral-500 text-xs">
              <Link
                href="/login"
                className="text-brand-300 transition hover:text-brand-200"
              >
                Volver al inicio de sesión
              </Link>
            </p>
          </div>
        </Card>

        <p className="mt-5 text-center text-neutral-600 text-xs">
          Copyright {new Date().getFullYear()} Trackt. Operación minera e
          industrial.
        </p>
      </div>
    </div>
  );
}
