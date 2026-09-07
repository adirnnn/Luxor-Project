# Habibi Parfums

Aplicación web para explorar, administrar e importar el inventario de perfumes de Habibi Parfums. El incremento más reciente se encuentra en [`Scrum/Sprint7/luxor-proj`](Scrum/Sprint7/luxor-proj).

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

## Ejecutar Sprint7 con Docker

```bash
cd Scrum/Sprint7/luxor-proj
docker compose up --build
```

Abre `http://localhost:5173`. El backend se expone en `http://localhost:3000` y PostgreSQL en el puerto local `5433`.

Antes de iniciar, crea `Scrum/Sprint7/luxor-proj/.env` con:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
POSTGRES_DB=habibi_parfums
POSTGRES_HOST=db
POSTGRES_PORT=5432
FRONTEND_URL=http://localhost:5173

PAYMENT_GATEWAY_API_KEY=
PAYMENT_GATEWAY_LATENCY_MS=400

```

## Desarrollo local

Frontend:

```bash
cd Scrum/Sprint7/luxor-proj
npm ci
npm run dev
```

Backend:

```bash
cd Scrum/Sprint7/luxor-proj/backend
npm ci
npm run seed
npm run dev
```

Para configurar otra API en el frontend, define `VITE_API_URL` en `.env.local`.

## Despliegue en producción

Cada pieza vive en un proveedor distinto:

| Componente | Proveedor | URL de producción |
| --- | --- | --- |
| Frontend (React + Vite) | Vercel | https://luxor-project-green.vercel.app |
| Backend (Node + Express) | Render (servicio Docker) | https://luxor-backend-9ov9.onrender.com |
| Chatbot (FastAPI) | Render (servicio Docker) | https://luxor-chatbot.onrender.com |
| Base de datos | PostgreSQL gestionado en Render (`luxor-db`) | — (host interno) |

- El *root directory* del proyecto en Vercel es `Scrum/Sprint7/luxor-proj`; el build usa `vercel.json`. Variables: `VITE_API_URL` y `VITE_CHATBOT_URL` (URLs del backend y del chatbot).
- Los dos servicios de Render y la base se describen en el blueprint [`render.yaml`](render.yaml) (raíz del repo). El chatbot usa un proveedor de LLM compatible con OpenAI (Groq) en producción porque Render no puede correr Ollama; se selecciona con `LLM_PROVIDER=groq`.
- El paso a paso completo (alta de servicios, tabla de variables, criterios de aceptación) está en [`Scrum/Sprint7/luxor-proj/docs/DEPLOY_RENDER.md`](Scrum/Sprint7/luxor-proj/docs/DEPLOY_RENDER.md).

### Desplegar una versión nueva

1. Hacer merge a `main`.
2. Vercel redepliega el frontend automáticamente en cada push a `main`.
3. Render vuelve a sincronizar el blueprint y redepliega backend y chatbot en cada push a `main`.
4. Los secretos (`LLM_API_KEY` de Groq) no viajan en el repo: se cargan a mano en el panel de Render (`luxor-chatbot` → Environment) y persisten entre despliegues.

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

Consulta [la especificación CSV](Scrum/Sprint7/luxor-proj/docs/CSV_IMPORT.md) y [el guion de presentación de Sprint7](Scrum/Sprint7/luxor-proj/docs/PRESENTACION_SPRINT5.md).

## Verificación

```bash
cd Scrum/Sprint7/luxor-proj/backend
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
