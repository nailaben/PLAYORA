const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
    try {
        const email = process.env.SELLER_EMAIL || 'admin@playora.com';
        const password = process.env.SELLER_PASSWORD || 'admin123';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Ensure seller exists or update password
        const check = await pool.query('SELECT * FROM sellers WHERE email = $1', [email]);
        if (check.rows.length > 0) {
            await pool.query('UPDATE sellers SET password_hash = $1 WHERE email = $2', [hash, email]);
            console.log(`Updated password for existing seller: ${email}`);
        } else {
            await pool.query('INSERT INTO sellers (name, email, password_hash) VALUES ($1, $2, $3)', [
                'PLAYORA Admin',
                email,
                hash
            ]);
            console.log(`Created new seller: ${email}`);
        }

        // Test verification
        const verify = await pool.query('SELECT password_hash FROM sellers WHERE email = $1', [email]);
        const match = await bcrypt.compare(password, verify.rows[0].password_hash);
        console.log(`Verification test with '${password}':`, match ? 'SUCCESS' : 'FAILED');

        await pool.end();
    } catch (err) {
        console.error('Error resetting admin:', err);
        process.exit(1);
    }
}

resetAdmin();
