require("dotenv").config();

const { Client } = require("pg");

const client = new Client({
    connectionString: process.env.DATABASE_URL
});

async function test() {
    try {
        await client.connect();

        console.log("✅ Connected to PostgreSQL");

        const result = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        console.log("Tables:");
        console.table(result.rows);

    } catch (error) {
        console.error("❌", error.message);
    } finally {
        await client.end();
    }
}

test();