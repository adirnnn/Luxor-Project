# Optimización de imágenes — SFTWRKEY-457

Medido el 27/10/2026 con Lighthouse 12.8.2, modo **móvil** (celular simulado con red 4G lenta), solo la categoría de rendimiento.

## Qué se cambió

- Las fotos de `public/assets/products/` y la textura de la portada pasaron de PNG/JPG a **WebP**, con un ancho máximo de 800 px
  (la textura, de 1024 px). Script: `node scripts/optimizar-imagenes.mjs`. Se borraron los originales, las fotos duplicadas de
  `src/assets/products/` (nadie las usaba) y tres imágenes sin uso (`temptabicon.png`, `hero_statue_*`, `bottle_spotlight_*`).
- `seed.js` cambia en la base las rutas `/assets/products/*.png|jpg` por `.webp`.
- El video de la portada se recodificó sin la pista de audio (siempre está en `muted`):
  `ffmpeg -i hero_sand.mp4 -an -c:v libx264 -crf 32 -preset slow -pix_fmt yuv420p -movflags +faststart`.
- Carga diferida (`loading="lazy"`) en el catálogo, en los relacionados (los dos usan `ProductCard`), en el buscador,
  en el carrito, en el pago y en las listas del admin. Las primeras 4 tarjetas del catálogo se cargan con prioridad,
  porque se ven al abrir la página.
- Las fotos que el admin sube desde el panel (**Subir foto**) se pasan a WebP de 800 px en el backend (`sharp`) y se
  guardan en la tabla `product_images`. Se sirven en `/product-images/<id>.webp` (Vercel las reenvía al backend).
  `vercel.json` activa el caché de ese reenvío (`x-vercel-enable-rewrite-caching`), así que una vez vista, la foto sale
  de la CDN de Vercel aunque el backend de Render esté dormido. Los errores (404/500) se responden con `no-store` para
  que la CDN nunca guarde una foto rota.
- Al compartir un perfume en WhatsApp o Facebook se usa una versión JPEG de la foto (`public/assets/products/og/` o
  `/product-images/<id>.jpg`), porque esas redes no siempre muestran WebP. Los perfumes sin foto usan `og-image.jpg`.
- Las rutas viejas (`/assets/products/*.png` y `*.jpg`) siguen funcionando: `vercel.json` las reenvía a su `.webp`.
  Así no hay fotos rotas mientras Render corre el seed después del deploy, ni en enlaces viejos.

## Peso de las imágenes

| | Antes | Después | Ahorro |
|---|---|---|---|
| Fotos de productos (16 archivos) | 15.8 MB | 574 KB | 96 % |
| Textura de la portada | 681 KB | 78 KB | 89 % |
| Video de la portada | 1.70 MB | 436 KB | 74 % |
| Foto subida desde el panel (Lattafa Yara, PNG 1024 px) | 1.82 MB | 48 KB | 97 % |

## Lighthouse móvil

| Página | Producción antes | Local antes | Local después |
|---|---|---|---|
| Portada `/` | 70 (LCP 5.8 s, 2.5 MB) | 75 (LCP 6.1 s, 2.5 MB) | **90–92** (LCP 3.0–3.3 s, 730 KB) |
| Catálogo `/perfumes` | 90 (LCP 3.4 s) | 92 (LCP 3.0 s) | **92–93** (LCP 2.9–3.0 s) |
| Detalle `/producto/khamrah` | 70 (LCP 13.7 s, 3.8 MB) | 73 (LCP 17.5 s, 3.8 MB) | **88** (LCP 3.5 s, 351 KB) |

"Local" es el build de producción (`vite build` + `vite preview`) con el backend y la base de pruebas. La portada y el
catálogo se midieron tres veces después del cambio. Lo que queda del tiempo de carga ya no son imágenes: es el JavaScript
de la aplicación (165 KB comprimido) y la hoja de fuentes de Google.

**Pendiente:** repetir la medición en producción después del deploy.
