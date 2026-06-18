import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TicketTrabajo } from "./tickets";

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: ok ? 200 : 500,
  });
}

describe("tickets api helpers", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.trackt.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("arma etiqueta de equipo desde codigo y nombre", async () => {
    const { getTicketEquipoLabel } = await import("./tickets");
    const ticket = {
      equipo: { codigo: "EQ-001", id: "eq-1", marca: null, modelo: null, nombre: "Camion", ubicacion: null },
      equipoNombre: "Fallback",
    } as TicketTrabajo;

    expect(getTicketEquipoLabel(ticket)).toBe("EQ-001 - Camion");
  });

  it("usa fallback cuando no hay equipo asociado", async () => {
    const { getTicketEquipoLabel } = await import("./tickets");

    expect(
      getTicketEquipoLabel({ equipoNombre: "Equipo externo" } as TicketTrabajo),
    ).toBe("Equipo externo");
    expect(getTicketEquipoLabel({} as TicketTrabajo)).toBe(
      "Equipo sin informacion",
    );
  });

  it("pagina todos los tickets disponibles", async () => {
    const { getAllTickets } = await import("./tickets");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: "ticket-1" }],
          meta: { limit: 100, page: 1, total: 2, totalPages: 2 },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: "ticket-2" }],
          meta: { limit: 100, page: 2, total: 2, totalPages: 2 },
        }),
      );

    const tickets = await getAllTickets(fetcher);

    expect(tickets).toEqual([{ id: "ticket-1" }, { id: "ticket-2" }]);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://api.trackt.test/tickets?page=1&limit=100",
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://api.trackt.test/tickets?page=2&limit=100",
    );
  });

  it("lanza error si el backend responde con fallo", async () => {
    const { getAllTickets } = await import("./tickets");
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({}, false));

    await expect(getAllTickets(fetcher)).rejects.toThrow(
      "No se pudieron cargar los tickets",
    );
  });
});
