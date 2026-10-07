# Importación de perfumes por CSV

El archivo debe guardarse en UTF-8 con extensión `.csv` y contener exactamente estos encabezados, en este orden:

```csv
id,name,price,image,description,stock,salida,corazon,fondo
```

Ejemplo:

```csv
noir-oud,Noir Oud,425.00,/assets/products/noir-oud.png,Fragancia amaderada,12,Bergamota,Rosa,Oud
```

- `id`: obligatorio, único dentro del archivo y en el inventario; letras, números y guiones.
- `name`: obligatorio, hasta 200 caracteres.
- `price`: número no negativo, con hasta dos decimales.
- `stock`: entero no negativo.
- `image`, `description`, `salida`, `corazon` y `fondo`: opcionales.

Las filas inválidas se rechazan y se muestran con el número de fila y la causa. Las filas válidas se importan de manera transaccional y cada intento queda registrado en el historial de importaciones.
