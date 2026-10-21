import { test } from "node:test";
import assert from "node:assert/strict";

import { rateLimit } from "./rateLimit.js";


function mockRes() {
    return {
        statusCode: 200,
        body: null,

        status(code) {
        this.statusCode = code;
        return this;
        },

        json(payload) {
        this.body = payload;
        return this;
        },
    };
}


test("rateLimit: permite solicitudes mientras no se alcance el límite", () => {
    const limiter = rateLimit({
        windowMs: 60_000,
        max: 3,
    });

    const req = {
        ip: "192.168.1.10",
        path: "/login",
    };

    for (let i = 0; i < 3; i++) {
        const res = mockRes();
        let nextCalled = false;

        limiter(req, res, () => {
        nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(res.statusCode, 200);
    }
});


test("rateLimit: bloquea solicitudes al superar el límite", () => {
    const limiter = rateLimit({
        windowMs: 60_000,
        max: 3,
    });

    const req = {
        ip: "192.168.1.20",
        path: "/login",
    };

    // Tres intentos permitidos
    for (let i = 0; i < 3; i++) {
        const res = mockRes();

        limiter(req, res, () => {});
    }

    // Cuarto intento bloqueado
    const res = mockRes();
    let nextCalled = false;

    limiter(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 429);
    assert.equal(res.body.success, false);

    assert.match(
        res.body.message,
        /demasiados intentos/i
    );
});


test("rateLimit: permite nuevos intentos después de la ventana", async () => {
    const limiter = rateLimit({
        windowMs: 20,
        max: 1,
    });

    const req = {
        ip: "192.168.1.30",
        path: "/login",
    };

    // Primer intento permitido
    let res = mockRes();
    let nextCalled = false;

    limiter(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);

    // Segundo intento bloqueado
    res = mockRes();
    nextCalled = false;

    limiter(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 429);

    // Esperar a que expire la ventana
    await new Promise(resolve =>
        setTimeout(resolve, 30)
    );

    // Nuevo intento permitido
    res = mockRes();
    nextCalled = false;

    limiter(req, res, () => {
        nextCalled = true;
    });

    assert.equal(nextCalled, true);
});