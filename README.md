# Perfumería Victoria

Tienda en línea de perfumes árabes y de diseñador: catálogo con búsqueda por notas olfativas, carrito, compra con o sin cuenta, seguimiento de pedidos, asistente virtual y panel de administración con reportes e importación de inventario.

- **Sitio en producción:** https://luxor-project-green.vercel.app
- **Código actual (Sprint 9):** [`Scrum/Sprint9/luxor-proj`](Scrum/Sprint9/luxor-proj). Su [README](Scrum/Sprint9/luxor-proj/README.md) explica cómo instalarlo, correr las pruebas y desplegarlo.

## Organización del repositorio

Se trabaja con Scrum. Cada sprint tiene su propia carpeta con el incremento entregado en ese sprint:

| Carpeta | Contenido |
| --- | --- |
| `Scrum/Sprint1` … `Scrum/Sprint8` | Incrementos anteriores (solo referencia) |
| `Scrum/Sprint9/luxor-proj` | Incremento actual; es el que se despliega y el que prueba el CI |
| `.github/workflows/` | Pruebas automáticas (frontend, backend, chatbot, integración y regresión) |
| `render.yaml` | Blueprint de Render (backend, chatbot y base de datos) |

## Arquitectura

| Componente | Tecnología | Producción |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS | Vercel |
| Funciones (vista previa para redes y sitemap) | Funciones de Vercel en Node.js | Vercel |
| Backend | Node.js, Express, PostgreSQL, JWT | Render (Docker) |
| Asistente virtual | Python, FastAPI, LLM (Ollama en local, Groq en producción) | Render (Docker) |
| Base de datos | PostgreSQL | Render |

## Inicio rápido

```bash
cd Scrum/Sprint9/luxor-proj
cp .env.example .env   # completar los valores
docker compose up --build
```

Abre `http://localhost:5173`. Más detalles en el [README del proyecto](Scrum/Sprint9/luxor-proj/README.md).

## Pruebas

```bash
cd Scrum/Sprint9/luxor-proj
npm ci && npm run test:run && npm run build   # frontend
cd backend && npm ci && npm test              # backend
```

GitHub Actions corre todas las suites en cada push o pull request a `main`.

## Equipo

- Dally Ramirez
- Denis Roberto Rodríguez Jiménez
- Diego Sandoval
- Javier Chávez
- Adrián López
