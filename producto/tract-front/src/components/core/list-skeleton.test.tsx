import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListSkeleton } from "./list-skeleton";

describe("ListSkeleton", () => {
  it("renderiza cuatro placeholders por defecto", () => {
    const { container } = render(<ListSkeleton />);

    expect(container.querySelectorAll(".rounded-lg.border")).toHaveLength(4);
    expect(container.firstChild).toHaveClass("xl:grid-cols-2");
  });

  it("respeta cantidad y columnas configuradas", () => {
    const { container } = render(<ListSkeleton columns={1} count={2} />);

    expect(container.querySelectorAll(".rounded-lg.border")).toHaveLength(2);
    expect(container.firstChild).not.toHaveClass("xl:grid-cols-2");
  });
});
