const { Pool } = require('pg');
require('dotenv').config();

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

pool.connect()
    .then(client => {
        console.log('Kết nối PostgreSQL thành công!');
        client.release();
    })
    .catch(error => {
        console.error('Kết nối PostgreSQL thất bại!');
        console.error(error.message);
    });

module.exports = pool;