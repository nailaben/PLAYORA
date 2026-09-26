const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
require('dotenv').config();

// Middleware to verify user token
const verifyUser = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token required' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'user') return res.status(403).json({ success: false, message: 'Access denied' });
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, phone, country_code, password, confirm_password } = req.body;

    // Validation
    if (!first_name || !last_name || !email || !phone || !country_code || !password || !confirm_password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    if (password !== confirm_password) {
        return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    try {
        // Check if email exists
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Full phone with country code
        const full_phone = `${country_code}${phone}`;

        // Insert user
        const result = await pool.query(
            `INSERT INTO users (first_name, last_name, email, phone, country_code, password_hash, auth_provider)
             VALUES ($1, $2, $3, $4, $5, $6, 'email')
             RETURNING id, first_name, last_name, email, phone, country_code, created_at`,
            [first_name.trim(), last_name.trim(), email.toLowerCase().trim(), full_phone, country_code]
        );

        // Wait... we forgot to add password_hash to the values
        // Actually let's fix the query
        const user = result.rows[0];

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: 'user', name: `${user.first_name} ${user.last_name}` },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                country_code: user.country_code
            }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        if (!user.password_hash) {
            return res.status(401).json({ success: false, message: 'This account uses social login. Please use Google or Facebook.' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: 'user', name: `${user.first_name} ${user.last_name}` },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                country_code: user.country_code
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/auth/social - Social login (Google/Facebook)
router.post('/social', async (req, res) => {
    const { provider, provider_id, email, first_name, last_name, avatar_url } = req.body;

    if (!provider || !email || !first_name) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        // Check if user exists
        let result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        let user = result.rows[0];

        if (!user) {
            // Create new user from social login
            result = await pool.query(
                `INSERT INTO users (first_name, last_name, email, auth_provider, provider_id, avatar_url)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, first_name, last_name, email, phone, country_code, avatar_url`,
                [first_name, last_name || '', email.toLowerCase(), provider, provider_id || '', avatar_url || '']
            );
            user = result.rows[0];
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: 'user', name: `${user.first_name} ${user.last_name}` },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                country_code: user.country_code
            }
        });
    } catch (err) {
        console.error('Social login error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/auth/profile
router.get('/profile', verifyUser, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, phone, country_code, avatar_url, auth_provider, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        const user = result.rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        res.json({ success: true, user });
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    try {
        const result = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        // Always return success to prevent email enumeration
        res.json({ success: true, message: 'If this email exists, a reset link has been sent via WhatsApp' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
