# Habibi Parfums

Aplicación web para explorar, administrar e importar el inventario de perfumes de Habibi Parfums. El incremento más reciente se encuentra en [`Scrum/Sprint5/luxor-proj`](Scrum/Sprint5/luxor-proj).

## Características

- Catálogo de perfumes, búsqueda, detalle y carrito de compras.
- Autenticación, registro y panel administrativo.
- Checkout con resumen de compra, validación y confirmación de pedido.
- Chatbot para consultas sobre fragancias.
- Categorías para perfumes e importación masiva de inventario mediante CSV.
- Reportes operativos e historial de importaciones.

## Tecnologías

- Frontend: React, TypeScript, Vite, Tailwind CSS y Framer Motion.
- Backend: Node.js, Express y PostgreSQL.
- Chatbot: FastAPI y proveedor LLM desacoplado.
- Infraestructura local: Docker Compose.

## Ejecutar Sprint5 con Docker

```bash
cd Scrum/Sprint5/luxor-proj
docker compose up --build
```

Abre `http://localhost:5173`. El backend se expone en `http://localhost:3000` y PostgreSQL en el puerto local `5433`.

Antes de iniciar, crea `Scrum/Sprint5/luxor-proj/.env` con:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=tu_contrasena_segura
POSTGRES_DB=habibi_parfums
POSTGRES_HOST=db
POSTGRES_PORT=5432
FRONTEND_URL=http://localhost:5173
```

## Desarrollo local

Frontend:

```bash
cd Scrum/Sprint5/luxor-proj
npm ci
npm run dev
```

Backend:

```bash
cd Scrum/Sprint5/luxor-proj/backend
npm ci
npm run seed
npm run dev
```

Para configurar otra API en el frontend, define `VITE_API_URL` en `.env.local`.

## Importación CSV de perfumes

En el panel administrativo, entra a **Importar CSV**. El formato exige estos encabezados, en este orden:

```csv
id,name,price,image,description,stock,salida,corazon,fondo
```

- `id`, `name`, `price` y `stock` son obligatorios.
- `id` debe ser único y usar letras, números y guiones.
- `price` debe ser un número no negativo con hasta dos decimales.
- `stock` debe ser un entero no negativo.
- Las filas inválidas muestran fila, campo y causa; las válidas se guardan transaccionalmente.

Consulta [la especificación CSV](Scrum/Sprint5/luxor-proj/docs/CSV_IMPORT.md) y [el guion de presentación de Sprint5](Scrum/Sprint5/luxor-proj/docs/PRESENTACION_SPRINT5.md).

## Verificación

```bash
cd Scrum/Sprint5/luxor-proj/backend
npm test

cd ..
npm run build
```

## Rutas principales

| Ruta | Descripción |
| --- | --- |
| `/` | Inicio y catálogo destacado. |
| `/perfumes` | Catálogo completo. |
| `/cart` | Carrito de compras. |
| `/login` | Inicio de sesión y registro. |
| `/payment` | Pago y confirmación de compra. |
| `/admin` | Panel de inventario, solo administradores. |
| `/admin/importar` | Importación CSV e historial, solo administradores. |
| `/reporte` | Reporte operativo, solo administradores. |

## Equipo

- Dally Ramirez
- Denis Roberto Rodríguez Jiménez
- Diego Sandoval
- Javier Chávez
- Adrián López
