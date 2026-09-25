const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function initDB() {
    try {
        console.log('Connecting to PostgreSQL...');
        const dbUser = process.env.DB_USER || 'marketplace_user';
        await pool.query(`CREATE SCHEMA IF NOT EXISTS "${dbUser}";`);
        await pool.query(`SET search_path TO "${dbUser}", public;`);
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        await pool.query(schema);
        console.log('Database initialized successfully with schema and sample data!');
        process.exit(0);
    } catch (err) {
        console.error('Database initialization failed:', err.message);
        process.exit(1);
    }
}

initDB();
