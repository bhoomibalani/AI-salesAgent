require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

pool.query("SELECT 1 AS ok")
    .then(result => {
        console.log("Node connection OK:", result.rows);
        return pool.end();
    })
    .catch(err => {
        console.error("Node connection FAILED:", err.message);
        return pool.end();
    });
