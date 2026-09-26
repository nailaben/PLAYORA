const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { testConnection } = require('./config/db');
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const sellerRouter = require('./routes/seller');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure images directory exists
const imagesDir = path.join(__dirname, 'public/images/products');
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/seller', sellerRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'PLAYORA API is running 🚀', timestamp: new Date() });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// Start server
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\nPLAYORA Server running on port ${PORT}`);
    console.log(`Store: http://localhost:${PORT}`);
    console.log(`Dashboard: http://localhost:${PORT}/seller/login.html`);
    console.log(`API: http://localhost:${PORT}/api/health\n`);
    await testConnection();
});
