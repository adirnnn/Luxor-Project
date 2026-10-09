
import { test } from "node:test";
import assert from "node:assert/strict";
import { validarPassword } from "./passwordPolicy.js";

test("rechaza contraseñas menores a 12 caracteres", () => {
    assert.match(
        validarPassword("Secreta123"),
        /12 caracteres/
    );
});

test("acepta contraseñas de exactamente 12 caracteres", () => {
    assert.equal(
        validarPassword("a".repeat(12)),
        null
    );
});

test("acepta contraseñas de hasta 72 bytes", () => {
    assert.equal(
        validarPassword("a".repeat(72)),
        null
    );
});

test("rechaza contraseñas mayores a 72 bytes", () => {
    assert.match(
        validarPassword("a".repeat(73)),
        /72 bytes/
    );
});

test("rechaza valores que no son texto", () => {
    assert.match(validarPassword(null), /texto válido/);
    assert.match(validarPassword(12345), /texto válido/);
});

test("permite espacios y caracteres especiales", () => {
    assert.equal(
        validarPassword("Mi contraseña segura!"),
        null
    );
});

test("valida correctamente caracteres Unicode", () => {
    // No suficientes caracteres
    assert.match(
        validarPassword("🔒".repeat(11)),
        /12 caracteres/
    );

    // Exactamente 12 caracteres
    assert.equal(
        validarPassword("🔒".repeat(12)),
        null
    );

    // Superando los 72 bytes.
    assert.match(
        validarPassword("🔒".repeat(19)),
        /72 bytes/
    );
});
