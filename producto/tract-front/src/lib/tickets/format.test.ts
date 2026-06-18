import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeDate, PRIORIDAD_LABEL } from "./format";

describe("ticket format helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-17T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve string vacio si no hay fecha", () => {
    expect(formatRelativeDate()).toBe("");
  });

  it("formatea fechas relativas en espanol", () => {
    expect(formatRelativeDate("2026-06-17T12:00:00.000Z")).toBe("ahora");
    expect(formatRelativeDate("2026-06-17T11:55:00.000Z")).toContain("5");
    expect(formatRelativeDate("2026-06-14T12:00:00.000Z")).toContain("3");
  });

  it("mantiene etiquetas legibles de prioridad", () => {
    expect(PRIORIDAD_LABEL).toEqual({
      ALTA: "Alta",
      BAJA: "Baja",
      MEDIA: "Media",
    });
  });
});
