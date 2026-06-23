import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authFetch } from "@/lib/api/http";

vi.mock("@/lib/api/http", () => ({
  authFetch: vi.fn(),
}));

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: ok ? 200 : 400,
  });
}

describe("equipos api helpers", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.trackt.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
    vi.resetModules();
  });

  it("consulta equipos con filtros y limite de pagina", async () => {
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({
        data: [{ codigo: "EQ-001", id: "eq-1", nombre: "Camion" }],
        meta: { limit: 100, page: 1, total: 1, totalPages: 1 },
      }),
    );
    const { getEquipos } = await import("./equipos");

    const equipos = await getEquipos({
      includeInactive: true,
      search: "camion",
    });

    expect(equipos).toEqual([
      { codigo: "EQ-001", id: "eq-1", nombre: "Camion" },
    ]);
    expect(authFetch).toHaveBeenCalledWith(
      "https://api.trackt.test/equipos?includeInactive=true&search=camion&page=1&limit=100",
    );
  });

  it("envia payload JSON al crear un equipo", async () => {
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({ codigo: "EQ-002", id: "eq-2", nombre: "Grua" }),
    );
    const { createEquipo } = await import("./equipos");
    const payload = {
      codigo: "EQ-002",
      marcaId: "m-cat",
      nombre: "Grua",
    };

    await createEquipo(payload);

    expect(authFetch).toHaveBeenCalledWith("https://api.trackt.test/equipos", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  });

  it("propaga mensajes de validacion enviados por el backend", async () => {
    vi.mocked(authFetch).mockResolvedValue(
      jsonResponse({ message: ["Codigo duplicado", "Nombre requerido"] }, false),
    );
    const { createEquipo } = await import("./equipos");

    await expect(
      createEquipo({ codigo: "EQ-001", nombre: "" }),
    ).rejects.toThrow("Codigo duplicado, Nombre requerido");
  });
});
