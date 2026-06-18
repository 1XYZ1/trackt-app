import { describe, expect, it } from "vitest";
import { filterByRole } from "./app-sidebar";
import { sidebarData } from "./data/sidebar-data";
import type { NavGroup } from "./types";

const titlesFrom = (groups: NavGroup[]) =>
  groups.flatMap((group) => group.items.map((item) => item.title));

describe("filterByRole", () => {
  it("muestra solo la navegacion operativa del mecanico", () => {
    const groups = filterByRole("mechanic", sidebarData.navGroups);

    expect(groups.map((group) => group.title)).toEqual([
      "Mi trabajo",
      "Cuenta",
    ]);
    expect(titlesFrom(groups)).toEqual(["Mis tickets", "Mi perfil"]);
  });

  it("muestra administracion solo para usuarios admin", () => {
    const groups = filterByRole("admin", sidebarData.navGroups);

    expect(groups.map((group) => group.title)).toEqual([
      "General",
      "Inventario",
      "Taller",
      "Administracion",
      "Cuenta",
    ]);
    expect(titlesFrom(groups)).toContain("Usuarios");
    expect(titlesFrom(groups)).toContain("Pendientes de validar");
  });

  it("oculta administracion para jefe de taller", () => {
    const groups = filterByRole("jefe_taller", sidebarData.navGroups);

    expect(groups.map((group) => group.title)).toEqual([
      "General",
      "Inventario",
      "Taller",
      "Cuenta",
    ]);
    expect(titlesFrom(groups)).not.toContain("Usuarios");
    expect(titlesFrom(groups)).not.toContain("Pendientes de validar");
  });

  it("muestra solo el grupo Inventario para jefe de inventario", () => {
    const groups = filterByRole("jefe_inventario", sidebarData.navGroups);

    expect(groups.map((group) => group.title)).toEqual([
      "Inventario",
      "Cuenta",
    ]);
    expect(titlesFrom(groups)).toEqual([
      "Inventario",
      "Movimientos",
      "Solicitudes pendientes",
      "Mi perfil",
    ]);
    expect(groups.map((group) => group.title)).not.toContain("General");
    expect(groups.map((group) => group.title)).not.toContain("Administracion");
  });

  it("filtra subitems y elimina grupos vacios", () => {
    const groups: NavGroup[] = [
      {
        title: "Grupo mixto",
        items: [
          {
            title: "Menu padre",
            icon: undefined,
            items: [
              {
                title: "Subitem admin",
                url: "/admin",
                roles: ["admin"],
              },
              {
                title: "Subitem mecanico",
                url: "/mecanico",
                roles: ["mechanic"],
              },
            ],
          },
        ],
      },
      {
        title: "Grupo restringido",
        roles: ["admin"],
        items: [
          {
            title: "Solo admin",
            url: "/solo-admin",
            roles: ["admin"],
          },
        ],
      },
    ];

    const filtered = filterByRole("mechanic", groups);

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.title).toBe("Grupo mixto");
    expect(filtered[0]?.items).toEqual([
      {
        title: "Menu padre",
        icon: undefined,
        items: [
          {
            title: "Subitem mecanico",
            url: "/mecanico",
            roles: ["mechanic"],
          },
        ],
      },
    ]);
  });
});
