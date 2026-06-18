import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TicketCard } from "./ticket-card";

describe("TicketCard", () => {
  it("muestra datos principales del ticket", () => {
    render(
      <TicketCard
        ticket={{
          codigo: "ITCM-001",
          equipo: "CAT 793F",
          estado: "ASIGNADO",
          mecanico: { nombre: "Ana Mecanica" },
          titulo: "Fuga hidraulica",
        }}
      />,
    );

    expect(screen.getByText("ITCM-001")).toBeInTheDocument();
    expect(screen.getByText("Fuga hidraulica")).toBeInTheDocument();
    expect(screen.getByText("CAT 793F")).toBeInTheDocument();
    expect(screen.getByText("Ana Mecanica")).toBeInTheDocument();
    expect(screen.getByText("Asignado")).toBeInTheDocument();
  });

  it("muestra fallback si no hay mecanico asignado", () => {
    render(
      <TicketCard
        ticket={{
          codigo: "ITCM-002",
          equipo: "Komatsu 930E",
          estado: "PENDIENTE",
          titulo: "Revision preventiva",
        }}
      />,
    );

    expect(screen.getByText("Sin mecanico")).toBeInTheDocument();
  });
});
