const fs = require('node:fs/promises')
const path = require('node:path')
const db = require('../DAO')
async function main() {
  if (!process.argv.includes('--apply')) throw Error('Use --apply to add word mastery state.')
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST))
    throw Error('Apply SQL manually for a shared database.')
  const client = await db.pool.connect()
  try {
    await client.query(await fs.readFile(path.join(__dirname, '009_word_mastery.sql'), 'utf8'))
    console.log('Word mastery state ready.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => db.pool.end())
