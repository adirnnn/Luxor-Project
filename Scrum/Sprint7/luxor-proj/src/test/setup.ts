// setup global de los tests del frontend. vitest lo carga antes de cada
// archivo de test (ver `test.setupFiles` en vite.config.ts).

// matchers extra para el DOM: toBeInTheDocument, toHaveClass, toBeDisabled, etc.
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// desmonta lo renderizado despues de cada test para que no se filtre estado
// entre uno y otro.
afterEach(() => {
  cleanup();
});
