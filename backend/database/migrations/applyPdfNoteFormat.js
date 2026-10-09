const fs=require('node:fs/promises'),path=require('node:path'),db=require('../DAO')
async function main(){
 if(!process.argv.includes('--apply'))throw Error('Use --apply to add the PDF note format column.')
 if(!['localhost','127.0.0.1','::1'].includes(process.env.DB_HOST))throw Error('Apply SQL manually for a shared database.')
 const client=await db.pool.connect()
 try{await client.query(await fs.readFile(path.join(__dirname,'007_pdf_note_format.sql'),'utf8'));console.log('PDF note format column ready; existing notes remain plain text.')}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.pool.end())
