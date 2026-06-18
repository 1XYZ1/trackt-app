import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("muestra titulo, mensaje e icono", () => {
    const { container } = render(
      <EmptyState
        icon="ticket"
        message="No hay tickets para este filtro."
        title="Sin tickets"
      />,
    );

    expect(screen.getByText("Sin tickets")).toBeInTheDocument();
    expect(
      screen.getByText("No hay tickets para este filtro."),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("permite extender clases del contenedor", () => {
    const { container } = render(
      <EmptyState
        className="min-h-20"
        icon="search"
        message="Prueba"
        title="Busqueda"
      />,
    );

    expect(container.firstChild).toHaveClass("min-h-20");
  });
});
