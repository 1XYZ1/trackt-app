import { describe, expect, it } from "vitest";
import { slugCodigo } from "./strings";

describe("slugCodigo", () => {
  it("genera codigos en mayusculas sin tildes y con guiones", () => {
    expect(slugCodigo("Filtro de aceite 2")).toBe("FILTRO-DE-ACEITE-2");
    expect(slugCodigo("Bujia NGK (x4)")).toBe("BUJIA-NGK-X4");
    expect(slugCodigo("Camion tolva - transmisión")).toBe(
      "CAMION-TOLVA-TRANSMISION",
    );
  });

  it("recorta guiones extremos y limita el largo a 60 caracteres", () => {
    const result = slugCodigo("  repuesto ".repeat(12));

    expect(result).toHaveLength(60);
    expect(result.startsWith("-")).toBe(false);
    expect(result.endsWith("-")).toBe(false);
  });
});
