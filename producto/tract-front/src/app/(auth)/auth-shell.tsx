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
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_29%,rgba(8,145,178,0.06),transparent_24%),linear-gradient(180deg,rgba(18,20,21,0.72),rgba(7,8,9,0.98)_45%,rgba(7,8,9,1))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-600/30 to-transparent" />

      <section className="relative flex w-full max-w-[330px] flex-col items-center justify-center">
        <Card className="w-full rounded-xl border border-white/10 bg-[#131415]/95 shadow-[0_20px_60px_rgba(0,0,0,0.44)] backdrop-blur-sm">
          <CardContent className="flex flex-col items-center px-5 py-6 text-center sm:px-6">
            <div className="mb-5 w-full text-center">
              <p className="font-medium text-[8px] text-zinc-600 uppercase tracking-[0.18em]">
                {eyebrow}
              </p>
              <h1 className="mt-2 font-semibold text-lg text-zinc-100 tracking-tight">
                {title}
              </h1>
              <p className="mx-auto mt-1.5 max-w-[245px] text-xs text-zinc-500 leading-5">
                {description}
              </p>
            </div>

            {children}
          </CardContent>

          {footer && (
            <div className="border-white/10 border-t px-5 py-4 text-center text-[9px] text-zinc-600 sm:px-6">
              {footer}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
