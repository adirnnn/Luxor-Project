# Pruebas de integración y regresión

Corren la API Express real contra una base PostgreSQL real (sin dobles de `pool`).

| Archivo | Tipo | Qué verifica |
|---|---|---|
| `auth.integration.js` | Integración | registro/login + bcrypt + JWT + tablas `users`/`rol` |
| `products.integration.js` | Integración | CRUD de productos del admin + JOIN con `categories` |
| `cart.integration.js` | Integración | carrito persistido, FK a `products` y ROLLBACK |
| `checkout.integration.js` | Integración | pasarela de pago + `orders`, `order_items`, `payments` y stock |
| `search.regression.js` | Regresión | la búsqueda oculta agotados, ignora mayúsculas y busca en notas |
| `checkout-stock.regression.js` | Regresión | sin sobreventa y total calculado con el precio de la base |
| `access-control.regression.js` | Regresión | un cliente no accede a datos de otros ni a rutas de admin |

## Correr localmente (requiere Docker)

```bash
npm run test:db:up      # PostgreSQL 16 desechable en el puerto 5434
npm run test:db:seed    # esquema + datos de seed.js
npm run test:integration
npm run test:regression
npm run test:db:down    # elimina el contenedor
```

`env.js` fija las variables antes de cargar `db.js`, así que el `.env` local nunca se usa
en estas pruebas. Cada prueba crea sus propios datos (`it-…`) y los borra al terminar.

En GitHub Actions las corre `.github/workflows/integration-regression.yml` en cada push o
pull request que toque `Scrum/Sprint9/luxor-proj/backend`.
