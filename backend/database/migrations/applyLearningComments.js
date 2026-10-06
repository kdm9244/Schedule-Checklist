const fs=require('node:fs'),path=require('node:path'),db=require('../DAO')
async function main(){
 if(process.argv[2]!=='--apply')throw new Error('Use --apply after checking backend/.env')
 const c=await db.pool.connect()
 try{
  await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='5s'");await c.query("SET LOCAL statement_timeout='30s'")
  await c.query("SELECT pg_advisory_xact_lock(hashtext('learning-comments-migration'))")
  if((await c.query("SELECT to_regclass('learning_comments') AS name")).rows[0].name)throw new Error('003 already applied')
  await c.query(fs.readFileSync(path.join(__dirname,'003_learning_comments.sql'),'utf8').replace(/^(BEGIN|COMMIT);$/gm,''))
  await c.query('COMMIT');console.log('003 applied; no sample data inserted')
 }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>db.pool.end())
