import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("combina clases condicionales", () => {
    expect(cn("base", false && "hidden", "active")).toBe("base active");
  });

  it("resuelve conflictos de Tailwind manteniendo la ultima clase", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });
});
