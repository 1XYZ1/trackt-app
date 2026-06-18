import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, KeyRound, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ResetForm } from './reset-form';

type ResetPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPageProps) {
  const { error } = await searchParams;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#05070d] px-4 py-10 text-neutral-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_48%,rgba(97,82,232,0.22),transparent_28%),radial-gradient(circle_at_78%_24%,rgba(30,41,59,0.36),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:28px_28px] opacity-35" />

      <section className="relative w-full max-w-[860px]">
        <Card className="overflow-hidden rounded-2xl border-white/10 bg-[#0d111c]/92 shadow-[0_28px_90px_rgba(0,0,0,0.52)] backdrop-blur-xl">
          <div className="grid min-h-[555px] md:grid-cols-[0.92fr_1.18fr]">
            <aside className="relative hidden overflow-hidden border-white/10 border-r px-10 py-12 md:flex md:flex-col md:items-center md:justify-center">
              <div className="relative z-10 flex flex-col items-center text-center">
                <Image
                  alt="Trackt"
                  className="h-[132px] w-[132px] object-contain"
                  height={132}
                  priority
                  src="/trackt-sidebar-logo.png"
                  width={132}
                />
                <h1 className="mt-6 font-bold text-4xl text-white tracking-tight">
                  Trackt
                </h1>
                <p className="mt-3 max-w-48 text-[17px] text-slate-400 leading-snug">
                  SaaS industrial de mantenimiento
                </p>
              </div>
              <KeyRound className="pointer-events-none absolute -bottom-9 -left-9 h-64 w-64 rotate-[-14deg] text-brand-primary/10" />
            </aside>

            <CardContent className="flex flex-col justify-center p-7 sm:p-10">
              <div className="mb-8 md:hidden">
                <div className="flex items-center gap-3">
                  <Image
                    alt="Trackt"
                    className="h-16 w-16 object-contain"
                    height={64}
                    priority
                    src="/trackt-sidebar-logo.png"
                    width={64}
                  />
                  <div>
                    <h1 className="font-bold text-3xl text-white tracking-tight">
                      Trackt
                    </h1>
                    <p className="text-slate-400 text-sm">
                      SaaS industrial de mantenimiento
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-7">
                <p className="font-semibold text-[11px] text-brand-300 uppercase tracking-[0.18em]">
                  Restablecer acceso
                </p>
                <h2 className="mt-3 font-bold text-3xl text-white tracking-tight">
                  Nueva contraseña
                </h2>
                <p className="mt-3 max-w-sm text-slate-400 text-base leading-relaxed">
                  Ingresa una nueva contraseña. Deberás iniciar sesión después
                  de actualizarla.
                </p>
              </div>

              {error && (
                <div className="mb-5 flex items-start gap-3 rounded-lg border border-destructive/35 bg-destructive/10 px-3.5 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium text-destructive text-sm">
                      No se pudo actualizar
                    </p>
                    <p className="mt-0.5 text-neutral-400 text-xs">{error}</p>
                  </div>
                </div>
              )}

              <ResetForm />

              <div className="mt-7 border-white/5 border-t pt-5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <ShieldCheck className="size-3.5" />
                    Acceso restringido al personal autorizado.
                  </div>
                  <Link
                    className="shrink-0 text-brand-300 transition hover:text-brand-200"
                    href="/login"
                  >
                    Volver al inicio
                  </Link>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        <p className="mt-5 text-center text-slate-600 text-xs">
          Copyright {new Date().getFullYear()} Trackt. Operación minera e
          industrial.
        </p>
      </section>
    </div>
  );
}
