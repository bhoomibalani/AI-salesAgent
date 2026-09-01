const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const config = require("./config");

let pool = null;

function getPool() {

    if (pool)
        return pool;

    if (!config.connectionString) {

        throw new Error(
            "Missing DATABASE_URL in .env. Start Docker Postgres with: npm run db:up"
        );

    }

    pool = new Pool({
        connectionString: config.connectionString
    });

    return pool;

}

async function query(text, params = []) {

    return getPool().query(text, params);

}

async function initSchema() {

    const schemaPath = path.join(__dirname, "schema.sql");

    const sql = fs.readFileSync(schemaPath, "utf8");

    await query(sql);

}

async function migrateSchema() {

    const migratePath = path.join(__dirname, "migrate.sql");

    const sql = fs.readFileSync(migratePath, "utf8");

    await query(sql);

}

async function closePool() {

    if (pool) {

        await pool.end();
        pool = null;

    }

}

module.exports = {

    getPool,
    query,
    initSchema,
    migrateSchema,
    closePool

};
