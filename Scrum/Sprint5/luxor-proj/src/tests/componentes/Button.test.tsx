// Pruebas del funcionamiento del componente Button

import { render, screen } from "@testing-library/react";
import { Button } from "../../components/ui/Button";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

// Test de renderizado de button
describe("Button", () => {
    it("debe renderizar el texto del botón", () => {
        render(<Button>Comprar</Button>);

        expect(screen.getByText("Comprar")).toBeInTheDocument();
    });

// Test de funcionamiento de click del button
    it("debe ejecutar onClick cuando se hace clic", async () => {
    const handleClick = vi.fn();

    render(
        <Button onClick={handleClick}>
        Comprar
        </Button>
    );

    const button = screen.getByRole("button", { name: "Comprar" });

    await userEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
    });

// Test de funcionamiento de la propiededad disabled del button
    it("renderiza el botón deshabilitado cuando recibe la prop disabled", () => {
        render(
            <Button disabled>
            Comprar
            </Button>
        );

        const button = screen.getByRole("button", {
            name: "Comprar",
        });

        expect(button).toBeDisabled();
        });
});

