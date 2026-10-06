const fs=require('node:fs'),path=require('node:path'),db=require('../DAO')
async function main(){
  if(process.argv[2]!=='--apply')throw new Error('Use --apply explicitly')
  const client=await db.pool.connect()
  try{
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout='5s'")
    await client.query("SET LOCAL statement_timeout='30s'")
    const target=(await client.query('SELECT current_database() AS database,host(inet_server_addr()) AS host')).rows[0]
    if(target.database!=='webProject'||!['::1','127.0.0.1'].includes(target.host))throw new Error('This runner only applies to the verified local webProject database')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('learning-period-migration'))")
    const exists=(await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='learning_roadmaps' AND column_name='start_date'")).rows.length
    if(exists)throw new Error('Migration 002 already applied; do not rerun')
    const sql=fs.readFileSync(path.join(__dirname,'002_learning_periods.sql'),'utf8').replace(/^(BEGIN|COMMIT);$/gm,'')
    await client.query(sql)
    await client.query('COMMIT')
    console.log(JSON.stringify({applied:true,target,sampleDataInserted:false}))
  }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>db.pool.end())
