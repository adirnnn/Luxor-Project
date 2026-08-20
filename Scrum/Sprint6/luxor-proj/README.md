# Habibi Parfums

Aplicación web para explorar, administrar e importar el inventario de perfumes de Habibi Parfums. Incluye catálogo, carrito, autenticación, panel administrativo, reportes y carga masiva de productos mediante CSV.

## Características

- Catálogo de perfumes, búsqueda y vista de detalle.
- Carrito de compras vinculado a usuarios autenticados.
- Autenticación (JWT) y registro de usuarios.
- Checkout con pasarela de pago simulada (aprobación/rechazo, historial de pagos).
- Asistente conversacional (chatbot) para consultar el catálogo por nombre, marca, categoría o nota, con recomendaciones y registro de consultas.
- Panel administrativo para crear, editar y eliminar perfumes.
- Reporte operativo con métricas y gráficas (ventas, inventario, productos top) para administradores.
- Importación masiva de perfumes desde CSV con validación, errores por fila, resumen e historial.
- Sincronización opcional de catálogo con PerfumAPI (búsqueda externa, mapeo e historial de errores).

## Tecnologías

- Frontend: React, TypeScript, Vite, Tailwind CSS y Framer Motion.
- Backend: Node.js, Express, PostgreSQL y JWT para autenticación.
- Chatbot: Python, FastAPI y un modelo LLM local vía Ollama.
- Contenedores: Docker Compose.

## Requisitos

- Node.js 20 o superior y npm.
- PostgreSQL 16, o Docker Desktop para ejecutar todos los servicios en contenedores.
- (Opcional) [Ollama](https://ollama.com) corriendo en el equipo anfitrión si vas a usar el chatbot.

## Inicio rápido con Docker

1. Crea un archivo `.env` en la raíz del proyecto (nunca lo subas a git; ya está listado en `.gitignore`) con, al menos, estas variables:

   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=tu_contrasena_segura
   POSTGRES_DB=habibi_parfums
   POSTGRES_HOST=db
   POSTGRES_PORT=5432
   FRONTEND_URL=http://localhost:5173

   # Firma los JWT de sesión. Genera uno propio, por ejemplo:
   # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   JWT_SECRET=reemplaza_esto_por_un_valor_aleatorio_largo

   # PerfumAPI (instancia pública, solo lectura) - ver docs/PERFUM_API.md
   PERFUM_API_BASE_URL=https://perfumapidatabase.onrender.com
   ```

   > **Seguridad:** todos los valores de arriba son de ejemplo. Usa contraseñas y secretos propios, distintos entre entornos, y **nunca** los comitees. `POSTGRES_PASSWORD` y `JWT_SECRET` deben rotarse si alguna vez se exponen (por ejemplo, si un `.env` termina en un commit).

2. Inicia los servicios:

   ```bash
   docker compose up --build
   ```

3. Abre `http://localhost:5173`. El backend queda disponible en `http://localhost:3000`, el chatbot en `http://localhost:8000` y PostgreSQL se expone en el puerto `5433` del equipo anfitrión.

El contenedor del backend ejecuta el seed al iniciar, creando las tablas y datos iniciales necesarios.

## Desarrollo local

Instala y ejecuta el frontend:

```bash
npm ci
npm run dev
```

En otra terminal, instala y ejecuta el backend:

```bash
cd backend
npm ci
npm run seed
npm run dev
```

Para que el frontend apunte a otra API, define `VITE_API_URL` en un archivo `.env.local`.

## Autenticación y seguridad

- `POST /login` valida credenciales con bcrypt y devuelve un JWT (`token`) además de los datos públicos del usuario.
- El frontend guarda el token en `localStorage` y lo envía como `Authorization: Bearer <token>` en cada petición a una ruta protegida (ver `src/services/apiClient.ts`).
- El backend valida el token con el middleware `authenticate` y aplica dos reglas de autorización (`backend/services/auth.js`):
  - **Dueño o ADMIN** (`authorizeSelfOrRoles`): rutas de perfil, carrito, historial de pedidos y checkout — un usuario solo puede operar sobre su propio `userId`, salvo un administrador.
  - **Solo ADMIN** (`requireRoles`): reportes/métricas, gestión de productos, importación CSV y sincronización con PerfumAPI.
- Rutas de lectura pública del catálogo (`/products`, `/categories`, `/products/search`, `/products/:id`) no requieren token.
- `/login` y el cambio de contraseña tienen un límite básico de intentos por minuto (`backend/services/rateLimit.js`).
- El monto del checkout siempre se recalcula en el servidor a partir del precio guardado en la base de datos; nunca se confía en un monto enviado por el cliente.

## Importación CSV de perfumes

En el panel de administración, selecciona **Importar CSV**. La pantalla permite descargar una plantilla, cargar el archivo, revisar el resumen de filas importadas y rechazadas, y consultar el historial de los últimos intentos.

El formato exige estos encabezados, en este orden:

```csv
id,name,price,image,description,stock,salida,corazon,fondo
```

Ejemplo:

```csv
noir-oud,Noir Oud,425.00,/assets/products/noir-oud.png,Fragancia amaderada,12,Bergamota,Rosa,Oud
```

- `id`, `name`, `price` y `stock` son obligatorios.
- `id` debe ser único y usar letras, números y guiones.
- `price` debe ser un número no negativo con hasta dos decimales.
- `stock` debe ser un entero no negativo.
- Las filas inválidas se rechazan con la fila, campo y causa concretos; las válidas se guardan de forma transaccional.

Consulta la especificación completa en [docs/CSV_IMPORT.md](docs/CSV_IMPORT.md).

## Verificación

Pruebas del backend (validador CSV, pasarela de pago simulada y middleware de autenticación):

```bash
cd backend
npm test
```

Compilación de producción del frontend:

```bash
npm run build
```

## Rutas principales

| Ruta | Descripción |
| --- | --- |
| `/` | Inicio y catálogo destacado. |
| `/perfumes` | Catálogo completo. |
| `/cart` | Carrito de compras. |
| `/login` | Inicio de sesión y registro. |
| `/mi-cuenta` | Perfil, cambio de contraseña e historial de pedidos (requiere sesión). |
| `/pago` | Checkout y confirmación de compra (requiere sesión). |
| `/admin` | Panel de inventario, solo administradores. |
| `/admin/importar` | Importación CSV e historial, solo administradores. |
| `/reporte` | Reporte operativo con métricas y gráficas, solo administradores. |

## Chatbot

El asistente conversacional (`backend/chatbot`) responde consultas del catálogo por nombre, marca, categoría o nota, sugiere perfumes relacionados y registra cada consulta (`/chatbot/queries` en el backend). Corre como un servicio FastAPI aparte y necesita un modelo servido por Ollama:

```bash
ollama pull qwen3:4b
ollama serve
```

Dentro de Docker Compose, el chatbot se conecta al backend por el nombre de servicio (`NODE_API_URL=http://backend:3000`) y a Ollama en el equipo anfitrión (`OLLAMA_URL=http://host.docker.internal:11434`, definidos en `docker-compose.yml`).

## LOGT

Los registros de tiempo (LOGT) de cada integrante del equipo para Sprint 6 están en [`LOGT/`](LOGT/): un archivo individual por persona y `LOGT_Sprint6_Equipo.docx` con los cinco juntos.
