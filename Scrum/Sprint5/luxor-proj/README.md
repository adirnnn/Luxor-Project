# Habibi Parfums

Aplicación web para explorar, administrar e importar el inventario de perfumes de Habibi Parfums. Incluye catálogo, carrito, autenticación, panel administrativo, reportes y carga masiva de productos mediante CSV.

## Características

- Catálogo de perfumes, búsqueda y vista de detalle.
- Carrito de compras vinculado a usuarios autenticados.
- Autenticación y registro de usuarios.
- Panel administrativo para crear, editar y eliminar perfumes.
- Reporte operativo para administradores.
- Importación masiva de perfumes desde CSV con validación, errores por fila, resumen e historial.

## Tecnologías

- Frontend: React, TypeScript, Vite, Tailwind CSS y Framer Motion.
- Backend: Node.js, Express y PostgreSQL.
- Contenedores: Docker Compose.

## Requisitos

- Node.js 20 o superior y npm.
- PostgreSQL 16, o Docker Desktop para ejecutar todos los servicios en contenedores.

## Inicio rápido con Docker

1. Crea un archivo `.env` en la raíz del proyecto con las credenciales de PostgreSQL que utilizará el backend y la base de datos:

   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=tu_contrasena_segura
   POSTGRES_DB=habibi_parfums
   POSTGRES_HOST=db
   POSTGRES_PORT=5432
   FRONTEND_URL=http://localhost:5173
   ```

2. Inicia los servicios:

   ```bash
   docker compose up --build
   ```

3. Abre `http://localhost:5173`. El backend queda disponible en `http://localhost:3000` y PostgreSQL se expone en el puerto `5433` del equipo anfitrión.

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

Pruebas del validador CSV:

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
| `/admin` | Panel de inventario, solo administradores. |
| `/admin/importar` | Importación CSV e historial, solo administradores. |
| `/reporte` | Reporte operativo, solo administradores. |
