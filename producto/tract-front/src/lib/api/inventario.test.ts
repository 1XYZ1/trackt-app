import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "@/lib/api/http";

vi.mock("@/lib/api/http", () => ({
  authFetch: vi.fn(),
}));

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: ok ? 200 : 409,
  });
}

describe("inventario api helpers", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.trackt.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
    vi.resetModules();
  });

  it("consulta repuestos con filtros operativos", async () => {
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({
        data: [{ codigo: "REP-001", id: "rep-1", nombre: "Filtro" }],
        meta: { limit: 100, page: 1, total: 1, totalPages: 1 },
      }),
    );
    const { getRepuestos } = await import("./inventario");

    const repuestos = await getRepuestos({
      bajoStock: true,
      categoria: "Filtros",
      includeInactive: true,
      search: "filtro",
    });

    expect(repuestos).toEqual([
      { codigo: "REP-001", id: "rep-1", nombre: "Filtro" },
    ]);
    expect(authFetch).toHaveBeenCalledWith(
      "https://api.trackt.test/inventario/repuestos?search=filtro&categoria=Filtros&bajoStock=true&includeInactive=true&page=1&limit=100",
    );
  });

  it("envia payload JSON al crear un repuesto", async () => {
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({ codigo: "REP-002", id: "rep-2", nombre: "Aceite" }),
    );
    const { createRepuesto } = await import("./inventario");
    const payload = {
      codigo: "REP-002",
      nombre: "Aceite",
      stockInicial: 10,
      stockMinimo: 2,
      unidad: "litro",
    };

    await createRepuesto(payload);

    expect(authFetch).toHaveBeenCalledWith(
      "https://api.trackt.test/inventario/repuestos",
      {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      },
    );
  });

  it("detalla faltantes cuando el backend rechaza una reserva por stock", async () => {
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse(
        {
          faltantes: [
            {
              codigo: "REP-003",
              disponible: 1,
              nombre: "Correa",
              requerido: 4,
            },
          ],
          message: "Stock insuficiente",
        },
        false,
      ),
    );
    const { createReserva } = await import("./inventario");

    await expect(
      createReserva("ticket-1", {
        items: [{ cantidad: 4, repuestoId: "rep-3" }],
      }),
    ).rejects.toThrow("Stock insuficiente: REP-003 (disponible 1, requerido 4)");
  });

  it("consulta movimientos con filtros y limite fijo", async () => {
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({
        data: [{ id: "mov-1", tipo: "ENTRADA" }],
        meta: { limit: 100, page: 1, total: 1, totalPages: 1 },
      }),
    );
    const { getMovimientos } = await import("./inventario");

    const movimientos = await getMovimientos({
      desde: "2026-06-01",
      hasta: "2026-06-18",
      repuestoId: "rep-1",
      ticketId: "ticket-1",
      tipo: "ENTRADA",
    });

    expect(movimientos).toEqual([{ id: "mov-1", tipo: "ENTRADA" }]);
    expect(authFetch).toHaveBeenCalledWith(
      "https://api.trackt.test/inventario/movimientos?repuestoId=rep-1&ticketId=ticket-1&tipo=ENTRADA&desde=2026-06-01&hasta=2026-06-18&limit=100",
    );
  });
});
