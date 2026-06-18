import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "@/lib/api/http";

vi.mock("@/lib/api/http", () => ({
  authFetch: vi.fn(),
}));

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: ok ? 200 : 500,
  });
}

describe("ordenes api helpers", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.trackt.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
    vi.resetModules();
  });

  it("adapta estados del backend al enum usado por el frontend", async () => {
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({
        data: [
          { codigo: "OT-001", estado: "EN_PROCESO", id: "ot-1" },
          { codigo: "OT-002", estado: "CERRADA", id: "ot-2" },
          { codigo: "OT-003", estado: "CANCELADA", id: "ot-3" },
        ],
      }),
    );
    const { getOrdenes } = await import("./ordenes");

    const ordenes = await getOrdenes();

    expect(ordenes.map((orden) => orden.estado)).toEqual([
      "EN_EJECUCION",
      "CERRADO",
      "CANCELADO",
    ]);
    expect(authFetch).toHaveBeenCalledWith("https://api.trackt.test/ordenes");
  });

  it("envia payload JSON al crear una orden", async () => {
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({ estado: "PENDIENTE", id: "ot-4" }),
    );
    const { createOrden } = await import("./ordenes");
    const payload = {
      descripcion: "Cambio preventivo",
      equipoId: "eq-1",
      prioridad: "MEDIA" as const,
    };

    const orden = await createOrden(payload);

    expect(orden.estado).toBe("PENDIENTE");
    expect(authFetch).toHaveBeenCalledWith("https://api.trackt.test/ordenes", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("lanza error si no puede cargar una orden", async () => {
    vi.mocked(authFetch).mockResolvedValue(jsonResponse({}, false));
    const { getOrdenById } = await import("./ordenes");

    await expect(getOrdenById("ot-error")).rejects.toThrow(
      "No se pudieron cargar las ordenes de trabajo",
    );
  });
});
