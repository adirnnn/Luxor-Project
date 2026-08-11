/*
Consultas SQL para futura generación de reportes y análisis de datos
*/


-- Ver cantidad de productos por categoria
SELECT 
    c.nombre AS categoria,
    COUNT(*) AS total_productos
FROM producto p
JOIN categoria c ON p.id_categoria = c.id_categoria
GROUP BY c.nombre;

-- Ver productos mas vendidos por categoria (GROUP BY + HAVING)
SELECT 
    c.nombre AS categoria,
    p.nombre AS producto,
    SUM(dp.cantidad) AS total_vendido
FROM detalle_pedido dp
JOIN producto p ON dp.id_producto = p.id_producto
JOIN categoria c ON p.id_categoria = c.id_categoria
GROUP BY c.nombre, p.nombre, p.id_categoria
HAVING SUM(dp.cantidad) > 1;

-- Productos que no han sido vendidos (subquery)
SELECT nombre
FROM producto
WHERE id_producto NOT IN (
    SELECT id_producto FROM detalle_pedido
);

-- Ver resumen de productos en carrito (GROUP BY)
SELECT 
    product_id,
    SUM(quantity) AS total_en_carrito
FROM cart_items
GROUP BY product_id
ORDER BY total_en_carrito DESC;