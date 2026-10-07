import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

    export const options = {
    stages: [
        { duration: "20s", target: 10 },
        { duration: "10s", target: 100 },
        { duration: "30s", target: 100 },
        { duration: "10s", target: 10 },
        { duration: "30s", target: 10 },
        { duration: "10s", target: 0 },
    ],

    thresholds: {
        http_req_failed: ["rate<0.05"],
        http_req_duration: ["p(95)<1500"],
    },
    };

    export default function () {
    const productsResponse = http.get(
        `${BASE_URL}/products`
    );

    check(productsResponse, {
        "GET /products responde 200": (r) =>
        r.status === 200,
    });

    const searchResponse = http.get(
        `${BASE_URL}/products/search?busqueda=Lattafa`
    );

    check(searchResponse, {
        "GET /products/search responde 200": (r) =>
        r.status === 200,
    });

    const categoriesResponse = http.get(
        `${BASE_URL}/categories`
    );

    check(categoriesResponse, {
        "GET /categories responde 200": (r) =>
        r.status === 200,
    });

    sleep(1);
}