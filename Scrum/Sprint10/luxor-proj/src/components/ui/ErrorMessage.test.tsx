import { render, screen } from "@testing-library/react";
import { ErrorMessage } from "./ErrorMessage";

describe("ErrorMessage", () => {
  it("muestra el mensaje que recibe por props", () => {
    render(<ErrorMessage message="No se pudo cargar el catalogo" />);
    expect(
      screen.getByText("No se pudo cargar el catalogo")
    ).toBeInTheDocument();
  });
});
