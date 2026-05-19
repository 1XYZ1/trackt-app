import { Command } from 'lucide-react';
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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-4 py-8 text-foreground">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.08),transparent_34%),linear-gradient(180deg,rgba(10,14,20,0.15),rgba(10,14,20,0.96))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

      <section className="relative w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Command className="size-4" />
            </div>
            <div className="text-left leading-tight">
              <p className="font-semibold text-base">Trackt</p>
              <p className="text-muted-foreground text-xs">Gestion de equipos</p>
            </div>
          </div>
        </div>

        <Card className="rounded-lg border-border/70 bg-card/95 shadow-[0_18px_55px_rgba(0,0,0,0.32)]">
          <CardContent className="p-6 sm:p-7">
            <div className="mb-6 text-center">
              <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
                {eyebrow}
              </p>
              <h1 className="mt-2 font-semibold text-xl tracking-tight">
                {title}
              </h1>
              <p className="mx-auto mt-1 max-w-xs text-muted-foreground text-sm">
                {description}
              </p>
            </div>

            {children}
          </CardContent>

          {footer && (
            <div className="border-border/70 border-t px-6 py-4 text-center text-muted-foreground text-xs sm:px-7">
              {footer}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
