// Isolated UI fixture: memory only, no authentication bypass in the application.
const express=require('express'),app=express()
app.use(require('cors')({origin:'http://localhost:5183',credentials:true}));app.use(express.json())
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
const content='BT /F1 20 Tf 60 750 Td (AP Practice - Question 1) Tj 0 -50 Td /F1 14 Tf (Explain the difference between TCP and UDP.) Tj ET'
objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
objects[1]='<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>'
objects.push(objects[2])
let pdf='%PDF-1.4\n',offsets=[0]
objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`})
const xref=Buffer.byteLength(pdf);pdf+='xref\n0 7\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
let entries=[],next=1
let words=[],nextWord=1
const note={note_id:'1',title:'AP 過去問題 · データベース',file_size:Buffer.byteLength(pdf),last_page:1,roadmap_id:'1',milestone_id:'10',task_id:'100',created_at:'2026-10-08T00:00:00Z'}
const sourcePdf=process.env.PDF_UI_SOURCE?require('node:fs').readFileSync(process.env.PDF_UI_SOURCE):Buffer.from(pdf)
const fileBytes=new Map([['1',sourcePdf]])
if(process.env.PDF_UI_SOURCE){note.title='AP 実技 DB';note.file_size=sourcePdf.length}
const notes=[note],record={record_id:'2',user_id:'pdf-ui-test',title:'正規化とトランザクションのまとめ',study_date:'2026-10-08',input_mode:'plain',milestone_id:'10',task_id:'100',body_markdown:'データベースの復習',updated_at:'2026-10-08T00:00:00Z'}
const roadmaps=[{roadmap_id:'1',title:'応用情報技術者試験',start_date:'2026-10-01',target_date:'2026-12-31'}],milestones=[{milestone_id:'10',roadmap_id:'1',title:'データベース',start_date:'2026-10-01',due_date:'2026-11-30'}],tasks=[{task_id:'100',milestone_id:'10',title:'過去問題を解く',is_completed:false},{task_id:'101',milestone_id:'10',title:'SQLの基礎を復習する',is_completed:false}]
milestones.push({milestone_id:'11',roadmap_id:'1',title:'ネットワーク',start_date:'2026-10-01',due_date:'2026-11-30'})
app.get('/api/users/me',(req,res)=>res.json({userId:'pdf-ui-test',userName:'UI test'}))
app.get('/api/learning',(req,res)=>res.json({roadmaps,milestones,tasks,records:[record],comments:[],schedules:[]}))
app.get('/api/pdf-notes/library',(req,res)=>{
 let items=[{...record,item_id:'2',kind:'regular',roadmap_id:'1'},...notes.map(n=>({...n,item_id:n.note_id,kind:'pdf',input_mode:'pdf',study_date:'2026-10-08'}))]
 for(const k of ['task_id','milestone_id','roadmap_id'])if(req.query[k])items=items.filter(i=>i[k]===req.query[k])
 const available=items.length
 if(req.query.kind&&req.query.kind!=='all')items=items.filter(i=>i.kind===req.query.kind)
 if(req.query.mode)items=items.filter(i=>i.input_mode===req.query.mode)
 if(req.query.q)items=items.filter(i=>i.title.includes(req.query.q)||i.body_markdown?.includes(req.query.q))
 res.json({items,total:items.length,page:1,pages:1,available})
})
app.post('/api/pdf-notes',express.raw({type:'application/pdf',limit:'30mb'}),(req,res)=>{const n={...note,note_id:String(notes.length+1),title:req.query.title,file_size:req.body.length,roadmap_id:req.query.roadmap_id,milestone_id:req.query.milestone_id,task_id:req.query.task_id};notes.push(n);fileBytes.set(n.note_id,req.body);res.status(201).json({note_id:n.note_id})})
app.get('/api/pdf-notes',(req,res)=>res.json([note]))
app.get('/api/pdf-notes/:id/file',(req,res)=>res.type('pdf').send(fileBytes.get(req.params.id)||sourcePdf))
app.get('/api/pdf-notes/:id/words',(req,res)=>res.json(words.filter(w=>w.note_id===req.params.id)))
const libraryService=require('../service/wordLibraryService')
app.get('/api/words',(req,res)=>res.json(libraryService.buildLibrary(words.map(w=>{const n=notes.find(n=>n.note_id===w.note_id);return {...w,updated_at:w.updated_at||'2026-10-09T00:00:00Z',pdf_title:n.title,roadmap_id:n.roadmap_id,milestone_id:n.milestone_id,roadmap_title:roadmaps.find(r=>r.roadmap_id===n.roadmap_id)?.title,milestone_title:milestones.find(m=>m.milestone_id===n.milestone_id)?.title}}),req.query)))
app.patch('/api/words',(req,res)=>{for(const w of words)if(req.body.ids.includes(w.word_id))Object.assign(w,{word:req.body.word,reading:req.body.reading,meaning:req.body.meaning});res.json({ok:true,count:req.body.ids.length})})
app.delete('/api/words',(req,res)=>{words=words.filter(w=>!req.body.ids.includes(w.word_id));res.json({ok:true,count:req.body.ids.length})})
app.post('/api/pdf-notes/:id/words',(req,res)=>{const w={...req.body,word_id:String(nextWord++),note_id:req.params.id};words.push(w);res.status(201).json(w)})
app.put('/api/pdf-notes/:id/words/:word',(req,res)=>{const w=words.find(w=>w.note_id===req.params.id&&w.word_id===req.params.word);Object.assign(w,req.body);res.json(w)})
app.delete('/api/pdf-notes/:id/words/:word',(req,res)=>{words=words.filter(w=>w.note_id!==req.params.id||w.word_id!==req.params.word);res.json({ok:true})})
app.get('/api/pdf-notes/:id',(req,res)=>res.json({note:notes.find(n=>n.note_id===req.params.id),entries:entries.filter(e=>e.note_id===req.params.id)}))
app.patch('/api/pdf-notes/:id',(req,res)=>{const n=notes.find(n=>n.note_id===req.params.id);Object.assign(n,req.body);res.json(n)})
app.post('/api/pdf-notes/:id/entries',(req,res)=>{const e={...req.body,note_id:req.params.id,entry_id:String(next++)};entries.push(e);res.json(e)})
app.put('/api/pdf-notes/:id/entries/:entry',(req,res)=>{const e=entries.find(e=>e.entry_id===req.params.entry&&e.note_id===req.params.id);Object.assign(e,req.body);res.json(e)})
app.delete('/api/pdf-notes/:id/entries/:entry',(req,res)=>{entries=entries.filter(e=>e.entry_id!==req.params.entry||e.note_id!==req.params.id);res.json({ok:true})})
app.delete('/api/pdf-notes/:id',(req,res)=>{const i=notes.findIndex(n=>n.note_id===req.params.id);if(i>=0)notes.splice(i,1);entries=entries.filter(e=>e.note_id!==req.params.id);res.json({ok:true})})
app.listen(3103,'127.0.0.1',()=>console.log('PDF isolated UI fixture on 3103'))
