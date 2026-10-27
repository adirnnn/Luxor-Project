// SFTWRKEY-457: pasa las fotos de productos y la textura de la portada a WebP.
// Uso: node scripts/optimizar-imagenes.mjs
// Crea el .webp al lado del original; los originales se borran a mano después de revisar.
// De cada foto de producto también deja un .jpg en public/assets/products/og/: es la que se usa al
// compartir el enlace de un perfume (WhatsApp y Facebook no siempre muestran WebP).
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// ancho máximo de cada carpeta: la tarjeta y el detalle nunca pasan de ~400 px en pantalla (800 para pantallas retina)
const CARPETAS = [
  { dir: 'public/assets/products', ancho: 800, compartir: 'public/assets/products/og' },
  { dir: 'public/images', ancho: 1024 },
];

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
let antes = 0;
let despues = 0;

for (const { dir, ancho, compartir } of CARPETAS) {
  if (compartir) await mkdir(compartir, { recursive: true });

  for (const archivo of await readdir(dir)) {
    if (!/\.(png|jpe?g)$/i.test(archivo)) continue;

    const origen = path.join(dir, archivo);
    const destino = origen.replace(/\.(png|jpe?g)$/i, '.webp');
    await sharp(origen)
      .resize({ width: ancho, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(destino);

    if (compartir) {
      await sharp(origen)
        .resize({ width: ancho, withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(path.join(compartir, archivo.replace(/\.(png|jpe?g)$/i, '.jpg')));
    }

    const pesoAntes = (await stat(origen)).size;
    const pesoDespues = (await stat(destino)).size;
    antes += pesoAntes;
    despues += pesoDespues;
    console.log(`${origen}: ${kb(pesoAntes)} -> ${kb(pesoDespues)}`);
  }
}

console.log(`\nTotal: ${kb(antes)} -> ${kb(despues)} (${Math.round((1 - despues / antes) * 100)} % menos)`);
