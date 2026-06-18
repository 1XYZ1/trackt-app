import type { ReactNode } from "react";

// Shell mobile-first para las páginas a las que redirige el QR físico del
// equipo: sin sidebar ni chrome de la app, centrado y a ancho de teléfono.
// React Query y ThemeProvider vienen del layout raíz.
export default function QrLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <span className="text-base font-semibold tracking-tight">Trackt</span>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
