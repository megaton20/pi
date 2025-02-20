
const { Pool } = require('pg');
require('dotenv').config();


const db = new Pool({
    host: process.env.PG_HOST,
    user: process.env.PG_USER, // Use a secure PostgreSQL username
    password: process.env.PG_PASSWORD, // Use a secure password
    database: process.env.PG_DATABASE, // Name of the database you're connecting to
    port: process.env.PG_PORT, // Default PostgreSQL port
    options: '-c search_path=public'
});

module.exports = db;

