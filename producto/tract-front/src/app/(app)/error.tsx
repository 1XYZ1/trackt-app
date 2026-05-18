"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircle, Home, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppSegmentError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[AppSegmentError]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertCircle className="size-5" />
          </div>
          <div>
            <CardTitle className="text-lg">No se pudo cargar la página</CardTitle>
            <CardDescription>
              Algo falló al cargar esta sección. Puedes reintentar o ir al
              dashboard.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error.digest && (
            <p className="font-mono text-muted-foreground text-xs">
              ref: {error.digest}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset} size="sm">
              <RotateCw className="size-4" />
              Reintentar
            </Button>
            <Button
              render={<Link href="/dashboard" />}
              size="sm"
              variant="outline"
            >
              <Home className="size-4" />
              Ir al dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
