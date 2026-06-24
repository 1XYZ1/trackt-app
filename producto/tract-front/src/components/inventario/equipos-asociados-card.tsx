"use client";

import Link from "next/link";
import { ChevronRight, Cog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/core";
import type { EquipoAsociado } from "@/lib/api/inventario";

// Card "Equipos asociados" del detalle del repuesto: lista los equipos que
// declaran este repuesto como insumo habitual (vía EquipoRepuesto), con su
// cantidad de referencia y observación. Cada item enlaza a la ficha del equipo.
export function EquiposAsociadosCard({
  equipos,
}: {
  equipos: EquipoAsociado[];
}) {
  return (
    <Card className="rounded-lg border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Equipos asociados</CardTitle>
        <p className="text-muted-foreground text-xs">
          Equipos que usan este repuesto como insumo de mantención.
        </p>
      </CardHeader>
      <CardContent className={equipos.length > 0 ? "p-0" : undefined}>
        {equipos.length > 0 ? (
          <ul className="divide-y divide-border/60">
            {equipos.map((asoc) => (
              <li key={asoc.id}>
                <Link
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-secondary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  href={`/equipos/${asoc.equipo.id}`}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Cog className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono text-muted-foreground text-xs">
                        {asoc.equipo.codigo}
                      </span>
                      {!asoc.equipo.activo && (
                        <Badge variant="outline">Inactivo</Badge>
                      )}
                      {asoc.cantidadRef != null && (
                        <Badge variant="secondary">
                          {asoc.cantidadRef} de ref.
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-medium text-sm">
                      {asoc.equipo.nombre}
                    </p>
                    {asoc.observacion && (
                      <p className="mt-0.5 truncate text-muted-foreground text-xs">
                        {asoc.observacion}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="min-h-44"
            icon="search"
            message="Ningún equipo declara este repuesto como insumo todavía."
            title="Sin equipos asociados"
          />
        )}
      </CardContent>
    </Card>
  );
}
