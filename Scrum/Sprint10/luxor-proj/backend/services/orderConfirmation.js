import { deliveryView } from './shipping.js';

export function createOrderConfirmationHandler({ pool }) {
    return async (req, res) => {
        res.set('Cache-Control', 'no-store');

        const id = Number(req.params.id);

        if (
        !/^\d+$/.test(req.params.id) ||
        !Number.isSafeInteger(id) ||
        id < 1
        ) {
        return res.status(400).json({
            success: false,
            message: 'El id del pedido no es válido.',
        });
        }

        try {
        const result = await pool.query(
            `SELECT id, total, status, created_at, shipping_cost, delivery_method, delivery_address
            FROM orders
            WHERE id = $1 AND user_id = $2`,
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
            success: false,
            message: 'Pedido no encontrado.',
            });
        }

        const [itemsResult, paymentResult] = await Promise.all([
            pool.query(
            `SELECT oi.product_id, p.name, oi.quantity, oi.unit_price
            FROM order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = $1
            ORDER BY oi.id`,
            [id]
            ),

            pool.query(
            `SELECT card_brand, card_last4
            FROM payments
            WHERE order_id = $1
                AND user_id = $2
                AND status = 'aprobado'
            ORDER BY created_at DESC, id DESC
            LIMIT 1`,
            [id, req.user.id]
            ),
        ]);

        const order = result.rows[0];
        const payment = paymentResult.rows[0];

        return res.json({
            success: true,
            order: {
            id: order.id,
            total: Number(order.total),
            status: order.status,
            created_at: order.created_at,
            // SFTWRKEY-449: envío y forma de entrega
            shipping: Number(order.shipping_cost ?? 0),
            delivery: deliveryView(order),
            items: itemsResult.rows.map((item) => ({
                product_id: item.product_id,
                name: item.name ?? item.product_id,
                quantity: item.quantity,
                unit_price: Number(item.unit_price),
                subtotal: Number(item.unit_price) * item.quantity,
            })),
            },
            payment: payment
            ? {
                brand: payment.card_brand,
                last4: payment.card_last4,
                }
            : null,
        });
        } catch (err) {
        console.error('Error al obtener la confirmación:', err);

        return res.status(500).json({
            success: false,
            message: 'No se pudo consultar la confirmación de compra.',
        });
        }
    };
}