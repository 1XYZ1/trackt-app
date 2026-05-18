import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="size-8" />
      </div>
      <div className="space-y-2">
        <p className="font-mono font-semibold text-muted-foreground text-sm">
          404
        </p>
        <h1 className="font-semibold text-3xl tracking-tight">
          Página no encontrada
        </h1>
        <p className="max-w-md text-muted-foreground text-sm">
          La ruta que intentas abrir no existe o fue movida. Verifica el enlace
          o vuelve al inicio.
        </p>
      </div>
      <Button render={<Link href="/dashboard" />}>
        <Home className="size-4" />
        Volver al inicio
      </Button>
    </div>
  );
}
