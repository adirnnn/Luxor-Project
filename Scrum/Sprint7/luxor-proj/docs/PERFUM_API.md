# Integración con PerfumAPI

Historia de usuario que justifica la integración: "Como administrador, quiero importar información desde una API externa para ampliar el catálogo automáticamente."

Repositorio de referencia: https://github.com/seccaz/PerfumAPI

## Resumen

PerfumAPI es una API tipo FastAPI que expone datos de perfumes obtenidos por
scraping de Fragrantica.com, almacenados en Postgres (Supabase). Es de uso
educativo/de prueba, pero ya existe una instancia pública desplegada y
funcionando que podemos **consumir tal cual**, sin desplegar nada nosotros.

## URLs — cuidado, el README es engañoso

El `README.md` del repo dice que la API está desplegada en
`https://perfumapi-frontend.onrender.com/`. **Esto es falso para efectos de
consumo de API**: esa URL sirve el frontend de demo (una SPA de Vite/React).
Probado con `curl`:

```
GET https://perfumapi-frontend.onrender.com/perfumes?limit=3   -> 404 Not Found
GET https://perfumapi-frontend.onrender.com/stats               -> 404 Not Found
```

La URL real del backend se encontró inspeccionando el bundle JS de esa SPA
(`assets/index-*.js`), que hace sus llamadas a:

```
https://perfumapidatabase.onrender.com
```

Verificado con `curl`:

```
GET https://perfumapidatabase.onrender.com/stats
-> {"total_perfumes":247,"database":"Supabase PostgreSQL","source":"Fragrantica.com"}

GET https://perfumapidatabase.onrender.com/perfumes/search/bleu?limit=3
-> [ { "name": "Bleu de Chanel Parfum Chanel", "brand": "Chanel", ... }, ... ]
```

**Esta es la URL base que usa Habibi Parfus: `PERFUM_API_BASE_URL=https://perfumapidatabase.onrender.com`.**

## Cold start (importante para la UX)

Es un servicio gratuito de Render. Si nadie lo usa por un rato, se
"duerme", y la primera petición después de eso tarda entre 30 y 60
segundos en responder mientras el contenedor arranca. Peticiones
siguientes son rápidas (\<1s). Implicaciones:

- El cliente HTTP del backend de Habibi Parfums debe usar un timeout generoso
  (45-60s) para la primera llamada.
- La UI de búsqueda del admin debe mostrar un estado de carga claro
  ("Conectando con PerfumAPI, puede tardar unos segundos...") en vez de
  fallar rápido y mostrar un error falso.

## Autenticación

- Los endpoints que Luxor necesita (`GET /perfumes`, `GET /perfumes/{id}`,
  `GET /perfumes/search/{query}`, `GET /stats`) son **públicos**, sin
  autenticación.
- Solo los endpoints de escritura/scraping (`POST /scrape`,
  `POST /scrape/brand`, `POST /scrape/brands`, `POST /scrape/url`,
  `POST /perfumes`) requieren `Authorization: Bearer <token>` (JWT emitido
  por Supabase Auth). Habibi Parfums **no usa estos endpoints** — no necesitamos
  crear/scrapear perfumes en PerfumAPI, solo leer/buscar los que ya tiene.
  Si en el futuro se quisiera usarlos, haría falta una cuenta de Supabase
  propia con acceso a ese proyecto — fuera de alcance de este sprint.

## Endpoints usados por Habibi Parfums

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/perfumes/search/{query}?limit=50` | Búsqueda del admin por nombre/marca/término libre |
| `GET` | `/perfumes?limit=&offset=` | Paginación para derivar el listado de marcas (tarea 4) |
| `GET` | `/perfumes/{perfume_id}` | (Disponible, no usado inicialmente — la búsqueda ya trae el objeto completo) |
| `GET` | `/stats` | Solo diagnóstico/salud de la integración |

## Modelo de datos de PerfumAPI

Cada perfume devuelto tiene esta forma (campos relevantes):

```json
{
  "id": "05a3e677-27b1-44ae-8053-62cfb4827d90",
  "name": "Bleu de Chanel Parfum Chanel",
  "brand": "Chanel",
  "release_year": 2018,
  "gender": "Men",
  "notes_top": ["Lemon Zest", "Bergamot", "Mint", "Artemisia"],
  "notes_middle": ["Lavender", "Pineapple", "Geranium", "Green Notes"],
  "notes_base": ["Sandalwood", "Cedar", "Amberwood", "Iso E Super", "Tonka Bean"],
  "rating": 4.44,
  "votes": 9057,
  "description": "Bleu de Chanel Parfum by Chanel is a Woody Aromatic fragrance...",
  "longevity": "7.1",
  "sillage": "5.5",
  "image_url": "https://fimgs.net/mdimg/perfume-thumbs/375x500.49912.jpg",
  "perfume_url": "https://www.fragrantica.com/perfume/Chanel/Bleu-de-Chanel-Parfum-49912.html",
  "created_at": "2025-10-16T10:15:07.946071+00:00"
}
```

No hay un endpoint `/brands` dedicado — la marca es solo un campo de cada
perfume (ver tarea 4 en el plan: derivamos el listado de marcas nosotros
mismos a partir de `GET /perfumes`).

## Mapeo de campos: PerfumAPI → modelo interno de Luxor (`products`)

| Campo PerfumAPI | Campo Habibi (`products`) | Transformación |
|---|---|---|
| `name` | `name` | directo |
| `brand` | `brand` (columna nueva) | directo |
| `image_url` | `image` | directo (URL absoluta, se guarda tal cual en el campo `VARCHAR(500)` existente) |
| `description` | `description` | directo |
| `notes_top` (array) | `salida` (string) | `notes_top.join(", ")` |
| `notes_middle` (array) | `corazon` (string) | `notes_middle.join(", ")` |
| `notes_base` (array) | `fondo` (string) | `notes_base.join(", ")` |
| `id` | `external_id` (columna nueva) | directo, para trazabilidad |
| — | `external_source` (columna nueva) | constante `"perfumapi"` |
| — | `synced_at` (columna nueva) | timestamp de cuándo se importó |
| — | `price`, `stock`, `category_id`, `id` (de Luxor) | **no vienen de la API** — el admin los define manualmente, como se pidió |

## Límites conocidos

- Solo 247 perfumes en la base al momento de esta investigación (2026) —
  cubre marcas populares pero no es exhaustivo.
- Sin rate limit documentado, pero el propio scraper de PerfumAPI respeta
  ~2s entre requests hacia Fragrantica (no afecta a Luxor, que solo hace
  lecturas contra la base ya scrapeada).
- Es un proyecto de terceros sin SLA — si el servicio de Render se cae o se
  suspende, la función de importación deja de funcionar hasta que vuelva
  (por eso se registran errores de sincronización — tarea 7 del plan).
