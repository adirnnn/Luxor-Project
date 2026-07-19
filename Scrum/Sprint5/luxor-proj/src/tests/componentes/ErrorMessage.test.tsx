import { render, screen } from "@testing-library/react";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { describe, expect, it} from "vitest";

// Test de renderizado de componente ErrorMessage
describe("ErrorMessage", () => {
    it("renderiza el mensaje de error recibido", () => {
        render(
        <ErrorMessage message="Correo electrónico inválido" />
        );

        expect(
        screen.getByText("Correo electrónico inválido")
        ).toBeInTheDocument();
    });
});