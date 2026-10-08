const express = require('express')
const fs = require('node:fs/promises')
const path = require('node:path')
const {randomUUID} = require('node:crypto')
const db = require('../database/DAO')
const router = express.Router()
const directory = path.resolve(process.env.PDF_STORAGE_DIR || path.join(__dirname,'../storage/pdf'))
const fail = (status,message) => Object.assign(new Error(message),{status})
const id = value => { if(!/^[1-9]\d{0,17}$/.test(String(value))) throw fail(400,'IDを確認してください。'); return String(value) }
const page = value => { if(!Number.isInteger(value)||value<1||value>100000) throw fail(400,'ページ番号を確認してください。'); return value }
function entry(input){
 const result = {page:page(input.page),status:input.status}
 if(!['draft','done','review'].includes(result.status))throw fail(400,'状態を確認してください。')
 for(const key of ['question','interpretation','solution','review']){
  if(typeof input[key]!=='string'||input[key].length>(key==='question'?200:key==='solution'?200000:50000))throw fail(400,'入力の長さを確認してください。')
  result[key]=input[key]
 }
 return result
}
router.use((req,res,next)=>req.session.userId?next():res.status(401).json({message:'ログインが必要です。'}))
const wrap = fn => async(req,res)=>{try{await fn(req,res)}catch(e){res.status(e.status||(['42P01'].includes(e.code)?503:500)).json({message:e.status?e.message:e.code==='42P01'?'PDFノートの初期設定（006）が必要です。':'PDFノートを処理できませんでした。'})}}
async function owned(req){const row=(await db.query('SELECT * FROM pdf_notes WHERE note_id=$1 AND user_id=$2',[id(req.params.id),req.session.userId])).rows[0];if(!row)throw fail(404,'PDFノートが見つかりません。');return row}
router.get('/',wrap(async(req,res)=>{
 const rows=(await db.query('SELECT note_id,title,file_size,roadmap_id,milestone_id,task_id,last_page,created_at FROM pdf_notes WHERE user_id=$1 ORDER BY note_id DESC',[req.session.userId])).rows
 res.json(rows)
}))
router.get('/library',wrap(async(req,res)=>{
 const input=req.query,values=[req.session.userId],bind=value=>{values.push(value);return '$'+values.length},where=['user_id=$1']
 for(const field of ['task_id','milestone_id','roadmap_id'])if(input[field])where.push(`${field}=${bind(id(input[field]))}`)
 const scopeCondition=where.join(' AND '),scopeValues=[...values]
 if(input.order&&!['newest','oldest'].includes(input.order))throw fail(400,'並び順を確認してください。')
 if(input.from&&input.to&&input.from>input.to)throw fail(400,'日付の範囲を確認してください。')
 if(input.kind&& !['all','regular','pdf'].includes(input.kind))throw fail(400,'ノートの種類を確認してください。')
 if(input.mode&&!['plain','markdown'].includes(input.mode))throw fail(400,'入力形式を確認してください。')
 if(input.kind&&input.kind!=='all')where.push(`kind=${bind(input.kind)}`)
 if(input.mode)where.push(`input_mode=${bind(input.mode)}`)
 const q=String(input.q||'').trim();if(q.length>200)throw fail(400,'検索は200文字以内で入力してください。')
 if(q)where.push(`search_body ILIKE ${bind('%'+q.replace(/[\\%_]/g,'\\$&')+'%')}`)
 for(const field of ['from','to'])if(input[field]){if(!require('../utils/validation').validDate(input[field]))throw fail(400,'日付を確認してください。');where.push(`study_date ${field==='from'?'>=':'<='} ${bind(input[field])}::date`)}
 const union=`WITH library AS (
 SELECT r.record_id::text AS item_id,'regular'::text AS kind,r.user_id,r.milestone_id,r.task_id,m.roadmap_id,r.title,r.study_date,r.input_mode,r.created_at, NULL::integer AS file_size,NULL::integer AS last_page,r.title||' '||r.body_markdown AS search_body FROM learning_records r LEFT JOIN learning_milestones m ON m.milestone_id=r.milestone_id AND m.user_id=r.user_id
 UNION ALL
 SELECT n.note_id::text,'pdf',n.user_id,n.milestone_id,n.task_id,n.roadmap_id,n.title,(n.created_at AT TIME ZONE 'Asia/Tokyo')::date,'pdf',n.created_at,n.file_size,n.last_page,n.title||' '||COALESCE((SELECT string_agg(e.question||' '||e.interpretation||' '||e.solution||' '||e.review,' ') FROM pdf_note_entries e WHERE e.note_id=n.note_id),'') FROM pdf_notes n
 )`
 const condition=where.join(' AND '),total=Number((await db.query(`${union} SELECT count(*) FROM library WHERE ${condition}`,values)).rows[0].count)
 const pages=Math.max(1,Math.ceil(total/8)),requested=Number(input.page||1)
 if(!Number.isInteger(requested)||requested<1)throw fail(400,'ページを確認してください。')
 const current=Math.min(requested,pages),direction=input.order==='oldest'?'ASC':'DESC'
 const items=(await db.query(`${union} SELECT item_id,kind,title,study_date::text,input_mode,file_size,last_page FROM library WHERE ${condition} ORDER BY study_date ${direction},created_at ${direction},kind,item_id::bigint ${direction} LIMIT 8 OFFSET ${bind((current-1)*8)}`,values)).rows
 const available=Number((await db.query(`${union} SELECT count(*) FROM library WHERE ${scopeCondition}`,scopeValues)).rows[0].count)
 res.json({items,total,page:current,pages,available})
}))
router.post('/',express.raw({type:'application/pdf',limit:'30mb'}),wrap(async(req,res)=>{
 if(!Buffer.isBuffer(req.body)||req.body.length<5||req.body.subarray(0,5).toString()!=='%PDF-')throw fail(400,'PDFファイルを選択してください（最大30MB）。')
 const title=String(req.query.title||'').trim();if(!title||title.length>200)throw fail(400,'タイトルは1〜200文字です。')
 const links=[]
 for(const [key,table] of [['roadmap_id','learning_roadmaps'],['milestone_id','learning_milestones'],['task_id','learning_tasks']]){
  const value=req.query[key]?id(req.query[key]):null
  const row=value?(await db.query(`SELECT * FROM ${table} WHERE ${key}=$1 AND user_id=$2`,[value,req.session.userId])).rows[0]:null
  if(value&&!row)throw fail(400,'学習の関連先を確認してください。')
  links.push({value,row})
 }
 if(links[2].row&&links[2].row.milestone_id!==links[1].value||links[1].row&&links[1].row.roadmap_id!==links[0].value)throw fail(400,'学習の関連先が一致しません。')
 const key=randomUUID();await fs.mkdir(directory,{recursive:true});const file=path.join(directory,key+'.pdf');await fs.writeFile(file,req.body,{flag:'wx'})
 try{res.status(201).json((await db.query('INSERT INTO pdf_notes(user_id,title,file_key,file_size,roadmap_id,milestone_id,task_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING note_id',[req.session.userId,title,key,req.body.length,...links.map(l=>l.value)])).rows[0])}catch(e){await fs.unlink(file).catch(()=>{});throw e}
}))
router.get('/:id',wrap(async(req,res)=>{const note=await owned(req);delete note.file_key;res.json({note,entries:(await db.query('SELECT * FROM pdf_note_entries WHERE note_id=$1 ORDER BY page,entry_id',[note.note_id])).rows})}))
router.get('/:id/file',wrap(async(req,res)=>{const note=await owned(req);res.set({'Content-Type':'application/pdf','Cache-Control':'private, no-store','Content-Disposition':'inline; filename="study.pdf"','X-Content-Type-Options':'nosniff'});res.sendFile(path.join(directory,note.file_key+'.pdf'),e=>{if(e&&!res.headersSent)res.status(404).json({message:'PDFファイルがありません。バックアップを確認してください。'})})}))
router.patch('/:id',wrap(async(req,res)=>{
 await owned(req)
 if(req.body.title!==undefined){const title=typeof req.body.title==='string'?req.body.title.trim():'';if(!title||title.length>200)throw fail(400,'タイトルは1〜200文字です。');await db.query('UPDATE pdf_notes SET title=$1 WHERE note_id=$2',[title,req.params.id])}
 else await db.query('UPDATE pdf_notes SET last_page=$1 WHERE note_id=$2',[page(req.body.last_page),req.params.id])
 res.json({ok:true})
}))
router.post('/:id/entries',wrap(async(req,res)=>{await owned(req);const e=entry(req.body);res.status(201).json((await db.query('INSERT INTO pdf_note_entries(note_id,question,page,interpretation,solution,review,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[req.params.id,e.question,e.page,e.interpretation,e.solution,e.review,e.status])).rows[0])}))
router.put('/:id/entries/:entry',wrap(async(req,res)=>{await owned(req);const e=entry(req.body);const row=(await db.query('UPDATE pdf_note_entries SET question=$1,page=$2,interpretation=$3,solution=$4,review=$5,status=$6,updated_at=now() WHERE note_id=$7 AND entry_id=$8 RETURNING *',[e.question,e.page,e.interpretation,e.solution,e.review,e.status,req.params.id,id(req.params.entry)])).rows[0];if(!row)throw fail(404,'解答が見つかりません。');res.json(row)}))
router.delete('/:id/entries/:entry',wrap(async(req,res)=>{await owned(req);await db.query('DELETE FROM pdf_note_entries WHERE note_id=$1 AND entry_id=$2',[req.params.id,id(req.params.entry)]);res.json({ok:true})}))
router.delete('/:id',wrap(async(req,res)=>{
 const client=await db.pool.connect();let original,staged,ocrStaged,committed=false
 try{
  await client.query('BEGIN')
  const note=(await client.query('SELECT * FROM pdf_notes WHERE note_id=$1 AND user_id=$2 FOR UPDATE',[id(req.params.id),req.session.userId])).rows[0]
  if(!note)throw fail(404,'PDFノートが見つかりません。')
  original=path.join(directory,note.file_key+'.pdf');staged=original+'.deleting'
  await fs.rename(original,staged).catch(e=>{if(e.code==='ENOENT')staged=null;else throw e})
  ocrStaged=path.join(directory,note.file_key+'.ocr.pdf.deleting')
  await fs.rename(path.join(directory,note.file_key+'.ocr.pdf'),ocrStaged).catch(e=>{if(e.code==='ENOENT')ocrStaged=null;else throw e})
  await client.query('DELETE FROM pdf_notes WHERE note_id=$1',[note.note_id]);await client.query('COMMIT');committed=true
  if(staged)await fs.unlink(staged).catch(()=>console.error('PDF deletion cleanup needed'))
  if(ocrStaged)await fs.unlink(ocrStaged).catch(()=>console.error('OCR PDF deletion cleanup needed'))
  res.json({ok:true})
 }catch(e){if(!committed){await client.query('ROLLBACK');if(staged)await fs.rename(staged,original).catch(()=>console.error('PDF deletion restore needed'));if(ocrStaged)await fs.rename(ocrStaged,ocrStaged.replace(/\.deleting$/,'')).catch(()=>console.error('OCR PDF deletion restore needed'))}throw e}finally{client.release()}
}))
router.use((e,req,res,next)=>{if(e.type==='entity.too.large')return res.status(413).json({message:'PDFは30MB以下にしてください。'});next(e)})
module.exports=router
module.exports.validateEntry=entry
