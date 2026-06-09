"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { ListFilter, Search, Ticket } from "lucide-react";
import {
  EmptyState,
  ListSkeleton,
  TICKET_ESTADOS,
  ticketEstadoLabel,
  type TicketEstado,
} from "@/components/core";
import { TicketsKanban } from "@/components/tickets/kanban/tickets-kanban";
import { TicketsLista } from "@/components/tickets/lista/tickets-lista";
import {
  TicketsViewToggle,
  type TicketsView,
} from "@/components/tickets/tickets-view-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useTickets } from "@/hooks/use-tickets";
import { type TicketTrabajo } from "@/lib/api/tickets";
import { cn } from "@/lib/utils";

export type TicketsSearchParams = {
  estado?: string | string[];
  mecanico?: string | string[];
  ot?: string | string[];
  q?: string | string[];
  vista?: string | string[];
};

type TicketFilterKey = keyof TicketsSearchParams;

const VISTA_STORAGE_KEY = "tickets:vista";
const estadosFiltro: ("TODOS" | TicketEstado)[] = ["TODOS", ...TICKET_ESTADOS];

function getParamValue(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

/** Filtros de texto (mecánico/OT/búsqueda) aplicados en ambas vistas. */
function matchesText(
  ticket: TicketTrabajo,
  filters: { mecanico: string; ot: string; q: string },
) {
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

  const vistaParam = getParamValue(
    searchParams.get("vista") ?? initialFilters.vista,
  );
  const vista: TicketsView = vistaParam === "lista" ? "lista" : "kanban";

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

  // Persistencia de la vista: si la URL no trae ?vista, restaurar la última
  // elegida desde localStorage (post-mount para evitar hydration mismatch). La
  // URL siempre gana para mantener links compartibles.
  useEffect(() => {
    if (vistaParam) return;
    const stored = window.localStorage.getItem(VISTA_STORAGE_KEY);
    if (stored === "lista" || stored === "kanban") {
      updateFilter("vista", stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vistaParam]);

  function handleViewChange(next: TicketsView) {
    window.localStorage.setItem(VISTA_STORAGE_KEY, next);
    updateFilter("vista", next);
  }

  const textFiltered = useMemo(
    () => tickets.filter((t) => matchesText(t, { mecanico, ot, q })),
    [mecanico, ot, q, tickets],
  );

  // En lista aplicamos también el filtro de estado; en kanban las columnas YA
  // representan el estado, así que se ignora.
  const listaTickets = useMemo(
    () =>
      estado && estado !== "TODOS"
        ? textFiltered.filter((t) => t.estado === estado)
        : textFiltered,
    [estado, textFiltered],
  );

  const hasResults =
    vista === "lista" ? listaTickets.length > 0 : textFiltered.length > 0;

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
            Arrastra tarjetas entre columnas para cambiar de estado, o cambia a
            vista lista para una mirada densa por estado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TicketsViewToggle onChange={handleViewChange} value={vista} />
          <Badge className="hidden w-fit sm:flex" variant="outline">
            <ListFilter />
            Filtros en URL
          </Badge>
        </div>
      </div>

      <Card className="rounded-lg border-border/70">
        <CardHeader className="gap-4 pb-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-base">Listado de tickets</CardTitle>
              <p className="text-muted-foreground text-xs">
                {textFiltered.length} resultado
                {textFiltered.length === 1 ? "" : "s"} segun filtros.
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
            {vista === "lista" ? (
              <div className="flex flex-wrap gap-1.5">
                {estadosFiltro.map((estadoOption) => {
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
                      {ticketEstadoLabel(estadoOption)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="hidden xl:block" />
            )}
            <Input
              defaultValue={filters.mecanico}
              onChange={(event) =>
                debouncedUpdateFilter("mecanico", event.target.value)
              }
              placeholder="Filtrar por mecanico"
            />
            <Input
              defaultValue={filters.ot}
              onChange={(event) => debouncedUpdateFilter("ot", event.target.value)}
              placeholder="Filtrar por OT"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && <ListSkeleton columns={2} count={4} />}

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

          {!isLoading && !error && tickets.length > 0 && !hasResults && (
            <EmptyState
              icon="search"
              message="Ajusta busqueda, estado, mecanico u OT para ver otros tickets."
              title="Sin resultados"
            />
          )}

          {!isLoading && !error && hasResults && vista === "kanban" && (
            <TicketsKanban tickets={textFiltered} />
          )}
          {!isLoading && !error && hasResults && vista === "lista" && (
            <TicketsLista tickets={listaTickets} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
