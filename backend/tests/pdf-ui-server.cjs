// Isolated UI fixture: memory only, no authentication bypass in the application.
const express=require('express'),app=express()
app.use(require('cors')({origin:'http://localhost:5183',credentials:true}));app.use(express.json())
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
const content='BT /F1 20 Tf 60 750 Td (AP Practice - Question 1) Tj 0 -50 Td /F1 14 Tf (Explain the difference between TCP and UDP.) Tj ET'
objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
let pdf='%PDF-1.4\n',offsets=[0]
objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`})
const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
let entries=[],next=1
const note={note_id:'1',title:'AP 過去問題 · データベース',file_size:Buffer.byteLength(pdf),last_page:1,roadmap_id:'1',milestone_id:'10',task_id:'100',created_at:'2026-10-08T00:00:00Z'}
const sourcePdf=process.env.PDF_UI_SOURCE?require('node:fs').readFileSync(process.env.PDF_UI_SOURCE):Buffer.from(pdf)
if(process.env.PDF_UI_SOURCE){note.title='AP 実技 DB';note.file_size=sourcePdf.length}
const notes=[note],record={record_id:'2',user_id:'pdf-ui-test',title:'正規化とトランザクションのまとめ',study_date:'2026-10-08',input_mode:'plain',milestone_id:'10',task_id:'100',body_markdown:'データベースの復習',updated_at:'2026-10-08T00:00:00Z'}
const roadmaps=[{roadmap_id:'1',title:'応用情報技術者試験',start_date:'2026-10-01',target_date:'2026-12-31'}],milestones=[{milestone_id:'10',roadmap_id:'1',title:'データベース',start_date:'2026-10-01',due_date:'2026-11-30'}],tasks=[{task_id:'100',milestone_id:'10',title:'過去問題を解く',is_completed:false},{task_id:'101',milestone_id:'10',title:'SQLの基礎を復習する',is_completed:false}]
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
app.post('/api/pdf-notes',express.raw({type:'application/pdf',limit:'30mb'}),(req,res)=>{const n={...note,note_id:String(notes.length+1),title:req.query.title,roadmap_id:req.query.roadmap_id,milestone_id:req.query.milestone_id,task_id:req.query.task_id};notes.push(n);res.status(201).json({note_id:n.note_id})})
app.get('/api/pdf-notes',(req,res)=>res.json([note]))
app.get('/api/pdf-notes/:id/file',(req,res)=>res.type('pdf').send(sourcePdf))
app.get('/api/pdf-notes/:id',(req,res)=>res.json({note:notes.find(n=>n.note_id===req.params.id),entries}))
app.patch('/api/pdf-notes/1',(req,res)=>{note.last_page=req.body.last_page;res.json({ok:true})})
app.post('/api/pdf-notes/1/entries',(req,res)=>{const e={...req.body,entry_id:String(next++)};entries.push(e);res.json(e)})
app.put('/api/pdf-notes/1/entries/:entry',(req,res)=>{const e=entries.find(e=>e.entry_id===req.params.entry);Object.assign(e,req.body);res.json(e)})
app.listen(3103,'127.0.0.1',()=>console.log('PDF isolated UI fixture on 3103'))
