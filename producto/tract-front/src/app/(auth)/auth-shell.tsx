import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';

type AuthShellProps = {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  footer?: React.ReactNode;
};

export function AuthShell({
  children,
  description,
  eyebrow,
  footer,
  title,
}: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#070809] px-4 py-8 text-zinc-200">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(21,24,26,0.76),rgba(7,8,9,0.96)_42%,rgba(6,7,8,1)),linear-gradient(90deg,rgba(255,255,255,0.025),transparent_32%,transparent_68%,rgba(255,255,255,0.025))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-500/30 to-transparent" />

      <section className="relative w-full max-w-[420px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/trackt-logo.png"
              alt="Trackt"
              width={92}
              height={92}
              priority
              className="h-[76px] w-[76px] object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
            />
            <div className="leading-tight">
              <p className="font-semibold text-lg text-zinc-100">Trackt</p>
              <p className="text-zinc-500 text-xs">Gestion de equipos</p>
            </div>
          </div>
        </div>

        <Card className="rounded-lg border-zinc-800/90 bg-[#181818]/95 shadow-[0_18px_55px_rgba(0,0,0,0.48)]">
          <CardContent className="p-6 sm:p-7">
            <div className="mb-6 text-center">
              <p className="font-medium text-[11px] text-zinc-500 uppercase tracking-[0.16em]">
                {eyebrow}
              </p>
              <h1 className="mt-2 font-semibold text-xl text-zinc-100 tracking-tight">
                {title}
              </h1>
              <p className="mx-auto mt-1 max-w-xs text-sm text-zinc-400">
                {description}
              </p>
            </div>

            {children}
          </CardContent>

          {footer && (
            <div className="border-zinc-800/90 border-t px-6 py-4 text-center text-xs text-zinc-500 sm:px-7">
              {footer}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
