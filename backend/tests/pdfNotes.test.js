const {test}=require('node:test')
const assert=require('node:assert/strict')
const path=require('node:path')
const fs=require('node:fs/promises')
const os=require('node:os')
process.env.PDF_STORAGE_DIR=path.join(os.tmpdir(),'pdf-notes-test-'+require('node:crypto').randomUUID())
const {validateEntry}=require('../router/pdfNoteRouter')
const valid=()=>({question:'AP 問1',page:1,interpretation:'解釈',solution:'理由',review:'',status:'draft'})
test('PDF entries reject invalid positions, status and oversized content',()=>{
 for(const patch of [{page:0},{page:1.5},{page:100001},{status:'unknown'},{solution:'x'.repeat(200001)},{question:null}])assert.throws(()=>validateEntry({...valid(),...patch}),e=>e.status===400)
 assert.deepEqual(validateEntry(valid()),valid())
})
test('PDF routes require authentication',async()=>{
 const app=require('express')();app.use((req,res,next)=>{req.session={};next()});app.use(require('../router/pdfNoteRouter'))
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r))
 try{const response=await fetch(`http://127.0.0.1:${server.address().port}/`);assert.equal(response.status,401)}finally{await new Promise(r=>server.close(r))}
})
test('real PDF upload, ownership, entry editing, position and file deletion',{skip:process.env.RUN_PDF_DB_TEST!=='1'},async()=>{
 const express=require('express'),db=require('../database/DAO'),app=express()
 const user=(await db.query('SELECT user_id FROM users ORDER BY user_id LIMIT 1')).rows[0];assert.ok(user,'A local logged-in user is required')
 app.use(express.json());app.use((req,res,next)=>{req.session={userId:req.headers['x-other']?String(BigInt(user.user_id)+1000000n):user.user_id};next()});app.use(require('../router/pdfNoteRouter'))
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;let noteId,recordId
 const json=(method,body)=>({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 try{
  const invalid=await fetch(base+'/?title=test',{method:'POST',headers:{'Content-Type':'application/pdf'},body:'invalid'});assert.equal(invalid.status,400)
  const sourceBytes=Buffer.from('%PDF-1.4\n%test fixture\n%%EOF')
  const uploaded=await fetch(base+'/?title=PDF-integration-test',{method:'POST',headers:{'Content-Type':'application/pdf'},body:sourceBytes});assert.equal(uploaded.status,201);noteId=(await uploaded.json()).note_id
  const stored=(await db.query('SELECT file_key FROM pdf_notes WHERE note_id=$1 AND user_id=$2',[noteId,user.user_id])).rows[0]
  await fs.writeFile(path.join(process.env.PDF_STORAGE_DIR,stored.file_key+'.ocr.pdf'),Buffer.from('%PDF-legacy-OCR-copy'))
  assert.equal((await fetch(base+'/'+noteId+'/ocr',{method:'PUT',headers:{'Content-Type':'application/pdf'},body:sourceBytes})).status,404)
  assert.equal(Object.hasOwn((await (await fetch(base+'/'+noteId)).json()).note,'ocr_ready'),false)
  assert.equal((await fetch(base+'/'+noteId,{headers:{'x-other':'1'}})).status,404)
  assert.equal((await fetch(base+'/'+noteId+'/file',{headers:{'x-other':'1'}})).status,404)
  const file=await fetch(base+'/'+noteId+'/file');assert.equal(file.headers.get('content-type'),'application/pdf');assert.match(await file.text(),/^%PDF-/)
  assert.ok(Buffer.from(await (await fetch(base+'/'+noteId+'/file')).arrayBuffer()).equals(sourceBytes),'legacy OCR copies must not be selected instead of the original')
  const created=await fetch(base+'/'+noteId+'/entries',json('POST',valid()));assert.equal(created.status,201);const entry=await created.json()
  assert.equal((await fetch(base+'/'+noteId+'/entries/'+entry.entry_id,{...json('PUT',{...valid(),status:'done'}),headers:{'Content-Type':'application/json','x-other':'1'}})).status,404)
  assert.equal((await fetch(base+'/'+noteId+'/entries/'+entry.entry_id,json('PUT',{...valid(),status:'review',solution:'updated'}))).status,200)
  assert.equal((await fetch(base+'/'+noteId,json('PATCH',{last_page:3}))).status,200)
  assert.equal((await fetch(base+'/'+noteId,json('PATCH',{title:'updated title'}))).status,200)
  const saved=await (await fetch(base+'/'+noteId)).json();assert.equal(saved.note.last_page,3);assert.equal(saved.entries[0].solution,'updated');assert.equal(saved.entries[0].status,'review')
  assert.equal(saved.note.title,'updated title')
  const destinations=(await db.query('SELECT milestone_id,roadmap_id FROM learning_milestones WHERE user_id=$1 ORDER BY milestone_id',[user.user_id])).rows
  if(destinations.length){
   const destination=destinations[destinations.length-1]
   const moved=await fetch(base+'/'+noteId,json('PATCH',{milestone_id:destination.milestone_id}));assert.equal(moved.status,200)
   const metadata=await moved.json();assert.equal(metadata.milestone_id,destination.milestone_id);assert.equal(metadata.roadmap_id,destination.roadmap_id)
   assert.equal((await (await fetch(base+'/'+noteId)).json()).entries[0].solution,'updated')
   assert.equal((await fetch(base+'/'+noteId,json('PATCH',{milestone_id:'999999999'}))).status,400)
   assert.equal((await (await fetch(base+'/'+noteId)).json()).note.milestone_id,destination.milestone_id)
   const another=destinations.find(m=>m.roadmap_id!==destination.roadmap_id)
   if(another){const changed=await (await fetch(base+'/'+noteId,json('PATCH',{milestone_id:another.milestone_id}))).json();assert.equal(changed.roadmap_id,another.roadmap_id)}
   assert.equal((await fetch(base+'/'+noteId,{...json('PATCH',{milestone_id:destination.milestone_id}),headers:{'Content-Type':'application/json','x-other':'1'}})).status,404)
  }
  const rich={...valid(),body_format:'richtext',solution:'<p><strong>重要</strong><mark style="background-color:#fff2a8" data-color="#fff2a8">復習</mark><script>evil()</script></p>'}
  assert.equal((await fetch(base+'/'+noteId+'/entries/'+entry.entry_id,json('PUT',rich))).status,200)
  const restored=(await (await fetch(base+'/'+noteId)).json()).entries[0];assert.equal(restored.body_format,'richtext');assert.match(restored.solution,/<strong>重要/);assert.doesNotMatch(restored.solution,/script|evil/)
  const richSearch=await (await fetch(base+'/library?q='+encodeURIComponent('重要復習'))).json();assert.ok(richSearch.items.some(i=>i.kind==='pdf'&&i.item_id===noteId))
  const marker='library-'+require('node:crypto').randomUUID()
  recordId=(await db.query("INSERT INTO learning_records(user_id,title,study_date,body_markdown,input_mode) VALUES($1,$2,'2026-10-08',$3,'plain') RETURNING record_id",[user.user_id,marker+' regular',marker+' content'])).rows[0].record_id
  await fetch(base+'/'+noteId,json('PATCH',{title:marker+' PDF'}))
  await fetch(base+'/'+noteId+'/entries/'+entry.entry_id,json('PUT',{...valid(),solution:marker+' content'}))
  const library=async(params,other=false)=>{const response=await fetch(base+'/library?'+new URLSearchParams(params),{headers:other?{'x-other':'1'}:{}});assert.equal(response.status,200);return response.json()}
  const all=await library({q:marker});assert.equal(all.total,2);assert.deepEqual(all.items.map(i=>i.kind).sort(),['pdf','regular'])
  assert.equal((await library({q:marker,kind:'pdf'})).total,1)
  assert.equal((await library({q:marker,mode:'plain'})).total,1)
  assert.equal((await library({q:marker+' content'})).total,2)
  assert.equal((await library({q:marker+'%'})).total,0)
  assert.equal((await library({q:marker},true)).total,0)
  assert.equal((await library({q:marker,page:999})).page,1)
  assert.equal((await library({q:marker,task_id:'999999999'})).available,0)
  assert.equal((await fetch(base+'/library?kind=invalid')).status,400)
  assert.equal((await fetch(base+'/'+noteId+'/entries/'+entry.entry_id,{method:'DELETE'})).status,200)
  await fetch(base+'/'+noteId+'/entries',json('POST',valid()))
  const deletedId=noteId
  assert.equal((await fetch(base+'/'+noteId,{method:'DELETE'})).status,200);noteId=null
  assert.equal((await db.query('SELECT * FROM pdf_note_entries WHERE note_id=$1',[deletedId])).rows.length,0)
  assert.equal((await fs.readdir(process.env.PDF_STORAGE_DIR)).length,0)
 }finally{
  if(recordId)await db.query('DELETE FROM learning_records WHERE record_id=$1 AND user_id=$2',[recordId,user.user_id])
  if(noteId)await fetch(base+'/'+noteId,{method:'DELETE'})
  await new Promise(r=>server.close(r));await fs.rmdir(process.env.PDF_STORAGE_DIR).catch(()=>{});await db.pool.end()
 }
})
