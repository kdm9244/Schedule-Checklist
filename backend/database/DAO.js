require('dotenv').config({ override: true })

const { Pool } = require('pg')

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

async function query(sql, params = []) {
  const result = await pool.query(sql, params)
  return result
}

module.exports = {
  query,
  pool,
}