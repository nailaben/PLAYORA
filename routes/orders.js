const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Generate unique order number
const generateOrderNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PLY-${timestamp}-${random}`;
};

// POST /api/orders - Create new order (public)
router.post('/', async (req, res) => {
    const { customer_name, customer_phone, customer_email, customer_address, notes, items } = req.body;

    if (!customer_name || !customer_phone || !customer_email || !customer_address || !items || items.length === 0) {
        return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Validate products and calculate total
        let subtotal = 0;
        const validatedItems = [];

        for (const item of items) {
            const productResult = await client.query(
                'SELECT * FROM products WHERE id = $1 AND is_active = true',
                [item.product_id]
            );

            if (productResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: `Product ${item.product_id} not found` });
            }

            const product = productResult.rows[0];

            if (product.stock_quantity < item.quantity) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name_ar}` });
            }

            const itemSubtotal = product.price * item.quantity;
            subtotal += itemSubtotal;

            validatedItems.push({
                product,
                quantity: item.quantity,
                unit_price: product.price,
                subtotal: itemSubtotal
            });
        }

        const total_amount = subtotal;
        const order_number = generateOrderNumber();

        // Create order
        const orderResult = await client.query(`
            INSERT INTO orders (order_number, customer_name, customer_phone, customer_email, customer_address, notes, subtotal, total_amount, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
            RETURNING *
        `, [order_number, customer_name, customer_phone, customer_email, customer_address, notes || '', subtotal, total_amount]);

        const order = orderResult.rows[0];

        // Create order items and update stock
        for (const item of validatedItems) {
            await client.query(`
                INSERT INTO order_items (order_id, product_id, product_name_ar, product_name_en, quantity, unit_price, subtotal)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [order.id, item.product.id, item.product.name_ar, item.product.name_en, item.quantity, item.unit_price, item.subtotal]);

            // Reduce stock
            await client.query(
                'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
                [item.quantity, item.product.id]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            order: {
                ...order,
                items: validatedItems.map(i => ({
                    product_name_ar: i.product.name_ar,
                    product_name_en: i.product.name_en,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    subtotal: i.subtotal
                }))
            }
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create order error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    } finally {
        client.release();
    }
});

// GET /api/orders - Get all orders (seller only)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `SELECT o.*, 
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
            FROM orders o WHERE 1=1`;
        const params = [];

        if (status && status !== 'all') {
            params.push(status);
            query += ` AND o.status = $${params.length}`;
        }

        query += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM orders ${status && status !== 'all' ? 'WHERE status = $1' : ''}`,
            status && status !== 'all' ? [status] : []
        );

        res.json({
            success: true,
            orders: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (err) {
        console.error('Get orders error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/orders/:id - Get single order with items (seller only)
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const itemsResult = await pool.query(`
            SELECT oi.*, p.image_url FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = $1
        `, [req.params.id]);

        res.json({
            success: true,
            order: orderResult.rows[0],
            items: itemsResult.rows
        });
    } catch (err) {
        console.error('Get order error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PATCH /api/orders/:id/status - Update order status (seller only)
router.patch('/:id/status', authMiddleware, async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'shipped', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    try {
        const result = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({ success: true, order: result.rows[0] });
    } catch (err) {
        console.error('Update order status error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
