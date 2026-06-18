import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEquipos } from "@/hooks/use-equipos";
import { EquipoSelect } from "./equipo-select";

vi.mock("@/hooks/use-equipos", () => ({
  useEquipos: vi.fn(),
}));

const equipos = [
  {
    activo: true,
    codigo: "EQ-001",
    id: "eq-1",
    marca: "CAT",
    modelo: "320",
    nombre: "Excavadora",
    ubicacion: "Mina norte",
  },
  {
    activo: true,
    codigo: "EQ-002",
    id: "eq-2",
    marca: "Komatsu",
    modelo: "930E",
    nombre: "Camion",
    ubicacion: "Mina sur",
  },
];

describe("EquipoSelect", () => {
  beforeEach(() => {
    vi.mocked(useEquipos).mockReturnValue({
      data: equipos,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useEquipos>);
  });

  it("muestra placeholder y lista equipos disponibles", async () => {
    render(<EquipoSelect onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /seleccionar equipo/i }));

    expect(screen.getByPlaceholderText("Buscar por codigo o nombre")).toBeInTheDocument();
    expect(screen.getByText("EQ-001 - Excavadora")).toBeInTheDocument();
    expect(screen.getByText("EQ-002 - Camion")).toBeInTheDocument();
  });

  it("filtra equipos por busqueda y notifica la seleccion", async () => {
    const onChange = vi.fn();
    render(<EquipoSelect onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /seleccionar equipo/i }));
    await userEvent.type(screen.getByPlaceholderText("Buscar por codigo o nombre"), "camion");
    expect(screen.queryByText("EQ-001 - Excavadora")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /eq-002 - camion/i }));

    expect(onChange).toHaveBeenCalledWith("eq-2");
  });

  it("marca visualmente el equipo seleccionado", async () => {
    render(<EquipoSelect onChange={vi.fn()} value="eq-1" />);

    await userEvent.click(screen.getByRole("button", { name: /eq-001 - excavadora/i }));
    const selectedRow = screen.getAllByRole("button", {
      name: /eq-001 - excavadora/i,
    })[1];

    expect(within(selectedRow).getByText("EQ-001 - Excavadora")).toBeInTheDocument();
    expect(selectedRow.querySelector(".opacity-100")).toBeInTheDocument();
  });

  it("muestra estado de error cuando no se pueden cargar equipos", async () => {
    vi.mocked(useEquipos).mockReturnValue({
      data: [],
      error: new Error("fallo"),
      isLoading: false,
    } as ReturnType<typeof useEquipos>);

    render(<EquipoSelect onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /seleccionar equipo/i }));

    expect(screen.getByText("No se pudieron cargar los equipos.")).toBeInTheDocument();
  });
});
