"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Search, Ticket } from "lucide-react";
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

  const isKanban = vista === "kanban";

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        // Vista kanban: ocupar el viewport restante (header + toolbar) para que el
        // board tenga altura fija y solo las columnas scrolleen. Vista lista:
        // flujo normal con scroll de página.
        isKanban && "h-[calc(100svh-10.5rem)] min-h-[28rem]",
      )}
    >
      {/* Toolbar única y compacta: título + filtros + toggle en una fila. */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-baseline gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Ticket className="size-4" />
            <h1 className="font-semibold text-foreground text-lg tracking-tight">
              Tickets
            </h1>
          </div>
          <span className="text-muted-foreground text-xs">
            {textFiltered.length} resultado{textFiltered.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-7 text-xs"
              defaultValue={filters.q}
              onChange={(event) => debouncedUpdateFilter("q", event.target.value)}
              placeholder="Buscar codigo o titulo"
              type="search"
            />
          </div>
          <Input
            className="h-8 w-full text-xs sm:w-40"
            defaultValue={filters.mecanico}
            onChange={(event) =>
              debouncedUpdateFilter("mecanico", event.target.value)
            }
            placeholder="Mecanico"
          />
          <Input
            className="h-8 w-full text-xs sm:w-32"
            defaultValue={filters.ot}
            onChange={(event) => debouncedUpdateFilter("ot", event.target.value)}
            placeholder="OT"
          />
          <TicketsViewToggle onChange={handleViewChange} value={vista} />
        </div>
      </div>

      {/* Chips de estado solo en vista lista (en kanban las columnas YA son el
          estado). */}
      {vista === "lista" && (
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
      )}

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

      {!isLoading && !error && hasResults && isKanban && (
        <div className="min-h-0 flex-1">
          <TicketsKanban tickets={textFiltered} />
        </div>
      )}
      {!isLoading && !error && hasResults && !isKanban && (
        <TicketsLista tickets={listaTickets} />
      )}
    </div>
  );
}
