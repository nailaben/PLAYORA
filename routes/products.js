const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Multer config for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../public/images/products');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// GET /api/products - Get all active products (public)
router.get('/', async (req, res) => {
    try {
        const { category, search, lang } = req.query;
        let query = `
            SELECT p.*, c.name_ar as category_name_ar, c.name_en as category_name_en, c.icon as category_icon
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = true
        `;
        const params = [];

        if (category && category !== 'all') {
            params.push(parseInt(category));
            query += ` AND p.category_id = $${params.length}`;
        }

        if (search) {
            params.push(`%${search}%`);
            query += ` AND (p.name_ar ILIKE $${params.length} OR p.name_en ILIKE $${params.length} OR p.description_ar ILIKE $${params.length} OR p.description_en ILIKE $${params.length})`;
        }

        query += ' ORDER BY p.created_at DESC';

        const result = await pool.query(query, params);
        res.json({ success: true, products: result.rows });
    } catch (err) {
        console.error('Get products error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/products/categories - Get all categories
router.get('/categories', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories ORDER BY id');
        res.json({ success: true, categories: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/products/:id - Get single product (public)
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, c.name_ar as category_name_ar, c.name_en as category_name_en
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = $1 AND p.is_active = true
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Get related products
        const product = result.rows[0];
        const related = await pool.query(`
            SELECT * FROM products
            WHERE category_id = $1 AND id != $2 AND is_active = true
            LIMIT 4
        `, [product.category_id, product.id]);

        res.json({ success: true, product, related: related.rows });
    } catch (err) {
        console.error('Get product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/products - Add new product (seller only)
router.post('/', authMiddleware, upload.single('image'), async (req, res) => {
    const { name_ar, name_en, description_ar, description_en, price, category_id, stock_quantity } = req.body;

    if (!name_ar || !name_en || !price) {
        return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    try {
        let image_url = req.body.image_url || null;
        if (req.file) {
            image_url = `/images/products/${req.file.filename}`;
        }

        const result = await pool.query(`
            INSERT INTO products (seller_id, name_ar, name_en, description_ar, description_en, price, category_id, stock_quantity, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `, [req.seller.id, name_ar, name_en, description_ar || '', description_en || '', price, category_id || null, stock_quantity || 0, image_url]);

        res.status(201).json({ success: true, product: result.rows[0] });
    } catch (err) {
        console.error('Add product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUT /api/products/:id - Update product (seller only)
router.put('/:id', authMiddleware, upload.single('image'), async (req, res) => {
    const { name_ar, name_en, description_ar, description_en, price, category_id, stock_quantity, is_active } = req.body;

    try {
        let image_url = req.body.image_url;
        if (req.file) {
            image_url = `/images/products/${req.file.filename}`;
        }

        const updateFields = [];
        const values = [];
        let idx = 1;

        if (name_ar !== undefined) { updateFields.push(`name_ar = $${idx++}`); values.push(name_ar); }
        if (name_en !== undefined) { updateFields.push(`name_en = $${idx++}`); values.push(name_en); }
        if (description_ar !== undefined) { updateFields.push(`description_ar = $${idx++}`); values.push(description_ar); }
        if (description_en !== undefined) { updateFields.push(`description_en = $${idx++}`); values.push(description_en); }
        if (price !== undefined) { updateFields.push(`price = $${idx++}`); values.push(price); }
        if (category_id !== undefined) { updateFields.push(`category_id = $${idx++}`); values.push(category_id); }
        if (stock_quantity !== undefined) { updateFields.push(`stock_quantity = $${idx++}`); values.push(stock_quantity); }
        if (is_active !== undefined) { updateFields.push(`is_active = $${idx++}`); values.push(is_active); }
        if (image_url !== undefined) { updateFields.push(`image_url = $${idx++}`); values.push(image_url); }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        values.push(req.params.id, req.seller.id);
        const result = await pool.query(`
            UPDATE products SET ${updateFields.join(', ')}
            WHERE id = $${idx} AND seller_id = $${idx + 1}
            RETURNING *
        `, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({ success: true, product: result.rows[0] });
    } catch (err) {
        console.error('Update product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// DELETE /api/products/:id - Delete product (seller only)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE products SET is_active = false WHERE id = $1 AND seller_id = $2 RETURNING *',
            [req.params.id, req.seller.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Delete product error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/products/seller/all - Get all seller products including inactive
router.get('/seller/all', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, c.name_ar as category_name_ar, c.name_en as category_name_en
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.seller_id = $1
            ORDER BY p.created_at DESC
        `, [req.seller.id]);

        res.json({ success: true, products: result.rows });
    } catch (err) {
        console.error('Get seller products error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
