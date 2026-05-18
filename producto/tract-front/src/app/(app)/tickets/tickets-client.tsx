"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ListFilter, Search, Ticket } from "lucide-react";
import {
  EmptyState,
  ListSkeleton,
  TicketCard,
  type TicketEstado,
  type TicketResumen,
} from "@/components/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useTickets } from "@/hooks/use-tickets";
import { getTicketEquipoLabel, type TicketTrabajo } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

export type TicketsSearchParams = {
  estado?: string | string[];
  mecanico?: string | string[];
  ot?: string | string[];
  q?: string | string[];
};

type TicketFilterKey = keyof TicketsSearchParams;

const estados: ("TODOS" | TicketEstado)[] = [
  "TODOS",
  "PENDIENTE",
  "ASIGNADO",
  "EN_EJECUCION",
  "EJECUTADO",
  "CERRADO",
  "CANCELADO",
];

function getParamValue(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function estadoLabel(estado: "TODOS" | TicketEstado) {
  if (estado === "TODOS") return "Todos";
  if (estado === "EN_EJECUCION") return "En ejecucion";
  return estado.charAt(0) + estado.slice(1).toLowerCase();
}

function toTicketResumen(ticket: TicketTrabajo): TicketResumen {
  return {
    codigo: ticket.codigo,
    equipo: getTicketEquipoLabel(ticket),
    estado: ticket.estado,
    mecanico: ticket.mecanico,
    titulo: ticket.titulo,
  };
}

function matchesFilters(
  ticket: TicketTrabajo,
  filters: {
    estado: string;
    mecanico: string;
    ot: string;
    q: string;
  },
) {
  if (filters.estado && filters.estado !== "TODOS" && ticket.estado !== filters.estado) {
    return false;
  }

  const mecanico = normalize(
    `${ticket.mecanico?.nombre ?? ""} ${ticket.mecanico?.email ?? ""}`,
  );
  if (filters.mecanico && !mecanico.includes(normalize(filters.mecanico))) {
    return false;
  }

  const orden = normalize(`${ticket.ordenCodigo ?? ""} ${ticket.ordenId}`);
  if (filters.ot && !orden.includes(normalize(filters.ot))) {
    return false;
  }

  const searchable = normalize(`${ticket.codigo} ${ticket.titulo}`);
  if (filters.q && !searchable.includes(normalize(filters.q))) {
    return false;
  }

  return true;
}

export function TicketsClient({
  initialFilters,
}: {
  initialFilters: TicketsSearchParams;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: tickets = [], error, isLoading } = useTickets();

  const filters = {
    estado: getParamValue(searchParams.get("estado") ?? initialFilters.estado),
    mecanico: getParamValue(
      searchParams.get("mecanico") ?? initialFilters.mecanico,
    ),
    ot: getParamValue(searchParams.get("ot") ?? initialFilters.ot),
    q: getParamValue(searchParams.get("q") ?? initialFilters.q),
  };
  const { estado, mecanico, ot, q } = filters;

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => matchesFilters(ticket, { estado, mecanico, ot, q })),
    [estado, mecanico, ot, q, tickets],
  );

  function updateFilter(key: TicketFilterKey, value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (!value || value === "TODOS") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const debouncedUpdateFilter = useDebouncedCallback(updateFilter, 300);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 font-medium text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
            <Ticket className="size-3.5" />
            Trabajo del taller
          </div>
          <h1 className="font-semibold text-2xl tracking-tight">Tickets</h1>
          <p className="mt-1 max-w-3xl text-muted-foreground text-sm">
            Lista global de tickets derivados de ordenes de trabajo, con
            trazabilidad por estado, mecanico y OT.
          </p>
        </div>
        <Badge className="w-fit" variant="outline">
          <ListFilter />
          Filtros en URL
        </Badge>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="gap-4 pb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-base">Listado de tickets</CardTitle>
              <p className="text-muted-foreground text-xs">
                {filteredTickets.length} resultado
                {filteredTickets.length === 1 ? "" : "s"} segun filtros.
              </p>
            </div>
            <div className="relative w-full xl:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-7"
                defaultValue={filters.q}
                onChange={(event) =>
                  debouncedUpdateFilter("q", event.target.value)
                }
                placeholder="Buscar codigo o titulo"
                type="search"
              />
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.2fr_0.7fr_0.7fr]">
            <div className="flex flex-wrap gap-1.5">
              {estados.map((estadoOption) => {
                const active = (filters.estado || "TODOS") === estadoOption;

                return (
                  <button
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium text-xs transition-colors",
                      active
                        ? "bg-brand-primary text-brand-primary-foreground"
                        : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                    key={estadoOption}
                    onClick={() => updateFilter("estado", estadoOption)}
                    type="button"
                  >
                    {estadoLabel(estadoOption)}
                  </button>
                );
              })}
            </div>
            <Input
              defaultValue={filters.mecanico}
              onChange={(event) =>
                debouncedUpdateFilter("mecanico", event.target.value)
              }
              placeholder="Filtrar por mecanico"
            />
            <Input
              defaultValue={filters.ot}
              onChange={(event) =>
                debouncedUpdateFilter("ot", event.target.value)
              }
              placeholder="Filtrar por OT"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && <ListSkeleton count={4} columns={2} />}

          {!isLoading && error && (
            <EmptyState
              icon="ticket"
              message="No se pudieron cargar los tickets desde la API."
              title="Error al cargar tickets"
            />
          )}

          {!isLoading && !error && tickets.length === 0 && (
            <EmptyState
              icon="ticket"
              message="Los tickets apareceran aqui cuando se creen desde una orden de trabajo."
              title="No hay tickets registrados"
            />
          )}

          {!isLoading && !error && tickets.length > 0 && filteredTickets.length === 0 && (
            <EmptyState
              icon="search"
              message="Ajusta busqueda, estado, mecanico u OT para ver otros tickets."
              title="Sin resultados"
            />
          )}

          {!isLoading && !error && filteredTickets.length > 0 && (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredTickets.map((ticket) => (
                <Link href={`/tickets/${ticket.id}`} key={ticket.id}>
                  <TicketCard
                    className="h-full transition-colors hover:border-brand-primary/40"
                    ticket={toTicketResumen(ticket)}
                  />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
