const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

pool.on('error', (error) => {
    // A Pool can emit errors for idle clients; log a concise diagnostic without
    // dumping connection configuration or other potentially sensitive details.
    console.error('PostgreSQL pool error:', error.message);
});

pool.connect()
    .then(client => {
        console.log('Kết nối PostgreSQL thành công!');
        client.release();
    })
    .catch(error => {
        console.error('Kết nối PostgreSQL thất bại:', error.message);
    });

module.exports = pool;
