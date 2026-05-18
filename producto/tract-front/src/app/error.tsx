"use client";

import { useEffect } from "react";
import { AlertOctagon, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertOctagon className="size-8" />
      </div>
      <div className="space-y-2">
        <h1 className="font-semibold text-2xl tracking-tight">
          Algo salió mal
        </h1>
        <p className="max-w-md text-muted-foreground text-sm">
          Ocurrió un error inesperado al cargar esta página. Puedes reintentar
          o volver al inicio.
        </p>
        {error.digest && (
          <p className="font-mono text-muted-foreground text-xs">
            ref: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="default">
        <RotateCw className="size-4" />
        Reintentar
      </Button>
    </div>
  );
}
