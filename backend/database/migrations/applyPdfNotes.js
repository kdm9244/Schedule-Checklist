const fs=require('node:fs/promises')
const path=require('node:path')
const db=require('../DAO')
async function main(){
 if(!process.argv.includes('--apply'))throw Error('Use --apply to create PDF note tables.')
 if(!['localhost','127.0.0.1','::1'].includes(process.env.DB_HOST))throw Error('This helper only applies to a local database. Apply the SQL manually for a shared server.')
 const client=await db.pool.connect()
 try{await client.query(await fs.readFile(path.join(__dirname,'006_pdf_notes.sql'),'utf8'));console.log('PDF note schema ready.')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.pool.end())
