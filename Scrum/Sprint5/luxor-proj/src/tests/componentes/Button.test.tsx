// Test para verificar si el botón se renderiza correctamente

import { render, screen } from "@testing-library/react";
import { Button } from "../../components/ui/Button";
import { describe, expect, it } from "vitest";

describe("Button", () => {
    it("debe renderizar el texto del botón", () => {
        render(<Button>Comprar</Button>);

        expect(screen.getByText("Comprar")).toBeInTheDocument();
    });
});