import Link from 'next/link';
import { Activity, AlertCircle } from 'lucide-react';
import { ResetForm } from './reset-form';

type ResetPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPageProps) {
  const { error } = await searchParams;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0b0f14] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="pointer-events-none absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 -bottom-40 h-[420px] w-[420px] rounded-full bg-blue-600/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-cyan-500/20 shadow-lg">
              <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="font-semibold text-3xl text-white tracking-tight">
              Trackt
            </h1>
          </div>
          <p className="text-sm text-zinc-400">Define tu nueva contraseña</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="p-7 sm:p-8">
            <div className="mb-6">
              <h2 className="font-semibold text-white text-xl">
                Nueva contraseña
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Ingresa una nueva contraseña. Deberas iniciar sesion despues
                de actualizarla.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div>
                  <p className="font-medium text-red-200 text-sm">
                    No se pudo actualizar
                  </p>
                  <p className="mt-0.5 text-red-300/80 text-xs">{error}</p>
                </div>
              </div>
            )}

            <ResetForm />
          </div>

          <div className="border-white/5 border-t px-7 py-4 sm:px-8">
            <p className="text-center text-xs text-zinc-500">
              <Link
                href="/login"
                className="text-cyan-400 transition hover:text-cyan-300"
              >
                Volver al inicio de sesion
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Copyright {new Date().getFullYear()} Trackt
        </p>
      </div>
    </div>
  );
}
