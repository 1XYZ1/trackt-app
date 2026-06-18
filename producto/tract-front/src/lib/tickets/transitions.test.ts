import { describe, expect, it } from "vitest";
import type { TicketTrabajo } from "@/lib/api/tickets";
import { canDrag, getTransition, getValidTargets } from "./transitions";

function ticket(
  estado: TicketTrabajo["estado"],
  mecanicoId = "mechanic-1",
): TicketTrabajo {
  return {
    codigo: "TK-001",
    descripcion: "Revision",
    estado,
    id: "ticket-1",
    mecanico: { id: mecanicoId, nombre: "Mecanico" },
    ordenId: "ot-1",
    prioridad: "MEDIA",
    titulo: "Ticket",
  };
}

describe("ticket transitions", () => {
  it("permite a admin y jefe_taller asignar tickets pendientes", () => {
    expect(getValidTargets(ticket("PENDIENTE"), "admin", "admin-1")).toEqual([
      "ASIGNADO",
    ]);
    expect(
      getValidTargets(ticket("PENDIENTE"), "jefe_taller", "jefe-1"),
    ).toEqual(["ASIGNADO"]);
  });

  it("solo permite iniciar al mecanico asignado", () => {
    expect(getTransition(ticket("ASIGNADO"), "EN_EJECUCION", "mechanic", "mechanic-1"))
      .toMatchObject({ action: "iniciar", requiereDialog: false });

    expect(
      getTransition(ticket("ASIGNADO"), "EN_EJECUCION", "mechanic", "otro"),
    ).toBeNull();
  });

  it("permite a admin validar tickets ejecutados", () => {
    expect(getValidTargets(ticket("EJECUTADO"), "admin", "admin-1")).toEqual([
      "CERRADO",
      "EN_EJECUCION",
    ]);
  });

  it("bloquea drag en estados terminales", () => {
    expect(canDrag(ticket("CERRADO"), "admin", "admin-1")).toBe(false);
    expect(canDrag(ticket("CANCELADO"), "mechanic", "mechanic-1")).toBe(false);
  });
});
