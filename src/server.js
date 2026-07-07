const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Pool } = require("pg");

const port = parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";

async function createTables() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  console.log("[db] Creating tables...");
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("render.com") ? { rejectUnauthorized: false } : undefined,
  });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scan_snapshots (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        instrument_key TEXT NOT NULL,
        ltp REAL, open REAL, high REAL, low REAL, close REAL,
        volume INTEGER, oi INTEGER, prev_oi INTEGER, change_oi INTEGER,
        avg_price REAL, net_change REAL,
        total_buy_qty INTEGER, total_sell_qty INTEGER,
        option_chain_data JSONB,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        symbol TEXT NOT NULL,
        alert_type TEXT NOT NULL,
        message TEXT NOT NULL,
        score REAL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("[db] Tables ready");
  } catch (e) {
    console.error("[db] Error:", e.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  await createTables();

  const app = next({ dev: false, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  }).listen(port, hostname, () => {
    console.log(`[server] Ready on http://${hostname}:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
