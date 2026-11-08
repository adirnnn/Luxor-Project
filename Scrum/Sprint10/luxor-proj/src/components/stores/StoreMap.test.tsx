// Feedback del cliente: cada local muestra su mapa de Waze con el pin exacto
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StoreLocations } from "./StoreMap";
import { DEFAULT_SHIPPING } from "../../utils/shipping";

describe("StoreLocations", () => {
  it("muestra el mapa de Waze y el enlace para llegar a cada local", () => {
    render(<StoreLocations stores={DEFAULT_SHIPPING.stores} />);

    expect(screen.getByTitle("Mapa de Joyería Luxor")).toHaveAttribute(
      "src",
      "https://embed.waze.com/iframe?zoom=17&lat=14.607718&lon=-90.469902&pin=1",
    );
    const enlaces = screen.getAllByRole("link", { name: "Cómo llegar con Waze" });
    expect(enlaces).toHaveLength(3);
    expect(enlaces[0]).toHaveAttribute("href", "https://waze.com/ul?ll=14.630721,-90.518181&navigate=yes");
  });

  it("un local sin coordenadas muestra solo su dirección", () => {
    render(<StoreLocations stores={[{ id: "nuevo", name: "Local nuevo", address: "Zona 10" }]} />);
    expect(screen.getByText("Zona 10")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
