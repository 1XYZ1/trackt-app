import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OtCard } from "./ot-card";

describe("OtCard", () => {
  it("muestra datos principales de la orden de trabajo", () => {
    render(
      <OtCard
        ot={{
          codigo: "OT-10482",
          descripcion: "Cambio de bomba hidraulica",
          equipo: "CAT 793F",
          estado: "EN_EJECUCION",
          ticketsCount: 3,
        }}
      />,
    );

    expect(screen.getByText("OT-10482")).toBeInTheDocument();
    expect(screen.getByText("CAT 793F")).toBeInTheDocument();
    expect(screen.getByText("Cambio de bomba hidraulica")).toBeInTheDocument();
    expect(screen.getByText("En ejecucion")).toBeInTheDocument();
    expect(screen.getByText("3 tickets")).toBeInTheDocument();
  });

  it("usa singular cuando existe solo un ticket asociado", () => {
    render(
      <OtCard
        ot={{
          codigo: "OT-10483",
          descripcion: "Inspeccion preventiva",
          equipo: "Komatsu 930E",
          estado: "PENDIENTE",
          ticketsCount: 1,
        }}
      />,
    );

    expect(screen.getByText("1 ticket")).toBeInTheDocument();
  });
});
