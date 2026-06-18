import type { ReactNode } from "react";
import type { Viewport } from "next";
import Image from "next/image";

// viewport-fit=cover habilita env(safe-area-inset-*) en iPhone con notch.
export const viewport: Viewport = {
  viewportFit: "cover",
};

// Shell mobile-first para las páginas a las que redirige el QR físico del
// equipo: sin sidebar ni chrome de la app. Altura de viewport dinámica
// (100dvh) con scroll interno en <main> — clave para que el contenido largo
// (alertas, acciones, tickets) scrollee en el teléfono. React Query y
// ThemeProvider vienen del layout raíz.
export default function QrLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-2.5 border-b bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
        <div className="flex h-14 items-center gap-2.5">
          <Image
            alt="Trackt"
            className="size-7 rounded-md object-contain"
            height={28}
            priority
            src="/trackt-sidebar-logo.png"
            width={28}
          />
          <div className="flex flex-col leading-none">
            <span className="font-semibold text-[15px] tracking-tight">
              Trackt
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
              Ficha de equipo
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
