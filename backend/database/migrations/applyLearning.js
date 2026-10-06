// Explicit, schema-only migration. No seed data or automatic startup migration.
const fs = require('node:fs')
const path = require('node:path')
const db = require('../DAO')
const tables = ['learning_roadmaps','learning_milestones','learning_tasks','learning_records','learning_schedules']
const existing = ['users','events','checklists','daily_memos','checklist_templates','checklist_template_skips','user_calendar_preferences']
async function counts(client,names) {
  const result={}
  for(const name of names)result[name]=(await client.query(`SELECT count(*)::text AS count FROM ${name}`)).rows[0].count
  return result
}
async function main() {
  if(process.argv[2]!=='--apply')throw new Error('Run explicitly with --apply; this script never inserts sample data.')
  const client=await db.pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    await client.query("SELECT pg_advisory_xact_lock(hashtext(current_database() || ':learning-migration-001'))")
    const target=(await client.query('SELECT current_database() AS database,current_schema() AS schema,inet_server_addr()::text AS host,inet_server_port() AS port')).rows[0]
    const found=(await client.query('SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename=ANY($1)',[tables])).rows.map(r=>r.tablename)
    if(found.length)throw new Error('Learning tables already exist. Inspect their schema before reapplying this one-time migration.')
    const before=await counts(client,existing)
    const sql=fs.readFileSync(path.join(__dirname,'001_learning.sql'),'utf8').replace(/^(?:BEGIN|COMMIT);[ \t]*\r?$/gm,'')
    await client.query(sql)
    const after=await counts(client,existing)
    const learning=await counts(client,tables)
    if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Existing row counts changed during migration; rolling back.')
    if(Object.values(learning).some(count=>count!=='0'))throw new Error('New learning tables are not empty; rolling back.')
    await client.query('COMMIT')
    console.log(JSON.stringify({applied:true,target,existingRowsUnchanged:true,learningRows:learning}))
  } catch(error) { await client.query('ROLLBACK');throw error } finally {client.release()}
}
main().catch(error=>{console.error('Migration failed:',error.code||error.message);process.exitCode=1}).finally(()=>db.pool.end())
