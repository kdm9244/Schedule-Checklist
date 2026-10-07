const {test} = require('node:test')
const assert = require('node:assert/strict')
const service = require('../service/learningService')
test('learning validation: required parent, title, real calendar dates, booleans and IDs',()=>{
  assert.throws(()=>service.normalize('milestones',{title:'Step',description:'',due_date:null}),{status:400})
  assert.throws(()=>service.normalize('roadmaps',{title:' ',description:'',target_date:null}),{status:400})
  assert.throws(()=>service.normalize('records',{title:'Note',body_markdown:'',study_date:'2026-02-30'}),{status:400})
  assert.throws(()=>service.normalize('tasks',{milestone_id:'1',title:'Task',is_completed:'false'}),{status:400})
  assert.throws(()=>service.identifier('1 OR 1=1'),{status:400})
  assert.throws(()=>service.identifier('9223372036854775808'),{status:400})
  assert.throws(()=>service.normalize('records',{title:'Note',study_date:'2026-10-06',body_markdown:'x'.repeat(200001)}),{status:400})
  assert.equal(service.normalize('records',{title:'Note',body_markdown:'```js\n  x()\n```',study_date:'2026-10-06',milestone_id:null,task_id:'2'}).task_id,null)
})

test('learning HTTP routes require the existing user session',async()=>{
  const express=require('express'),app=express()
  app.use(express.json());app.use((req,res,next)=>{req.session={};next()})
  app.use('/api/learning',require('../router/learningRouter'))
  const server=app.listen(0,'127.0.0.1')
  await new Promise(resolve=>server.once('listening',resolve))
  try {
    for(const [method,path] of [['GET',''],['POST','/roadmaps'],['PATCH','/records/1'],['DELETE','/roadmaps/1'],['POST','/milestones/reorder']]) {
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api/learning${path}`,{method})
      assert.equal(response.status,401)
    }
  } finally {await new Promise(resolve=>server.close(resolve))}
})

test('an authenticated session receives setup status, not a login error, when tables are missing',async()=>{
  const express=require('express'),app=express(),original=service.snapshot
  service.snapshot=async()=>{throw Object.assign(new Error('Missing table'),{code:'42P01'})}
  app.use((req,res,next)=>{req.session={userId:'1'};next()})
  app.use('/api/learning',require('../router/learningRouter'))
  const server=app.listen(0,'127.0.0.1')
  await new Promise(resolve=>server.once('listening',resolve))
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/learning`)
    assert.equal(response.status,503)
    const body=await response.json()
    assert.equal(body.code,'LEARNING_SCHEMA_NOT_READY')
    assert.match(body.message,/ログインは完了/)
  } finally {service.snapshot=original;await new Promise(resolve=>server.close(resolve))}
})

test('learning SQL and CRUD in PostgreSQL temporary tables only; no migration applied', {skip:process.env.RUN_LEARNING_SQL_TEST!=='1'},async()=>{
  const fs=require('node:fs'),path=require('node:path'),dao=require('../database/DAO')
  const client=await dao.pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('CREATE TEMP TABLE users (user_id BIGSERIAL PRIMARY KEY) ON COMMIT DROP')
    await client.query('CREATE TEMP TABLE events (event_id BIGSERIAL PRIMARY KEY,user_id BIGINT NOT NULL,is_deleted BOOLEAN NOT NULL DEFAULT FALSE) ON COMMIT DROP')
    let sql=fs.readFileSync(path.join(__dirname,'../database/migrations/001_learning.sql'),'utf8')
    sql=sql.replace(/^BEGIN;|^COMMIT;/gm,'').replace(/CREATE TABLE (learning_\w+)/g,'CREATE TEMP TABLE $1').replace(/CREATE FUNCTION (learning_\w+)/g,'CREATE FUNCTION pg_temp.$1').replace(/EXECUTE FUNCTION (learning_\w+)/g,'EXECUTE FUNCTION pg_temp.$1')
    await client.query(sql)
    let periods=fs.readFileSync(path.join(__dirname,'../database/migrations/002_learning_periods.sql'),'utf8').replace(/^BEGIN;|^COMMIT;/gm,'').replace(/CREATE FUNCTION (learning_\w+)/g,'CREATE FUNCTION pg_temp.$1').replace(/EXECUTE FUNCTION (learning_\w+)/g,'EXECUTE FUNCTION pg_temp.$1')
    await client.query(periods)
    await client.query(fs.readFileSync(path.join(__dirname,'../database/migrations/003_learning_comments.sql'),'utf8').replace(/^BEGIN;|^COMMIT;/gm,'').replace('CREATE TABLE learning_comments','CREATE TEMP TABLE learning_comments'))
    await client.query(fs.readFileSync(path.join(__dirname,'../database/migrations/004_learning_comment_ranges.sql'),'utf8').replace(/^BEGIN;|^COMMIT;/gm,''))
    await client.query(fs.readFileSync(path.join(__dirname,'../database/migrations/005_learning_task_periods.sql'),'utf8').replace(/^BEGIN;|^COMMIT;/gm,''))
    const users=(await client.query('INSERT INTO users DEFAULT VALUES RETURNING user_id')).rows
    const userId=users[0].user_id
    const other=(await client.query('INSERT INTO users DEFAULT VALUES RETURNING user_id')).rows[0].user_id
    const db={query:(sql,args)=>client.query(sql,args),pool:{connect:async()=>({query:(sql,args)=>client.query(sql==='BEGIN'?'SAVEPOINT learning_request':sql==='COMMIT'?'RELEASE SAVEPOINT learning_request':sql==='ROLLBACK'?'ROLLBACK TO SAVEPOINT learning_request':sql,args),release(){}})}}
    let data=await service.save('roadmaps',userId,null,{title:'Roadmap',description:'',start_date:'2026-10-01',target_date:'2026-12-01'},db)
    const r=data.roadmaps[0].roadmap_id
    await assert.rejects(service.save('milestones',userId,null,{roadmap_id:r,title:'Outside',description:'',start_date:'2026-09-30',due_date:'2026-10-10'},db),{status:400})
    data=await service.save('milestones',userId,null,{roadmap_id:r,title:'Step',description:'Criteria',start_date:'2026-10-01',due_date:'2026-10-10'},db)
    const m=data.milestones[0].milestone_id
    data=await service.save('milestones',userId,null,{roadmap_id:r,title:'Next',description:'',start_date:'2026-10-10',due_date:'2026-12-01'},db)
    await assert.rejects(service.save('roadmaps',userId,r,{target_date:'2026-11-01'},db),{status:400})
    const m2=data.milestones[1].milestone_id
    data=await service.reorder(userId,r,[m2,m],db)
    assert.equal(data.milestones.find(x=>x.milestone_id===m2).sort_order,0)
    await assert.rejects(service.reorder(userId,r,[m,m],db),{status:409})
    data=await service.save('tasks',userId,null,{milestone_id:m,title:'Code',start_date:'2026-10-01',target_date:'2026-10-10'},db)
    const t=data.tasks[0].task_id
    await assert.rejects(service.save('tasks',other,null,{milestone_id:m,title:'Not mine'},db),{status:404})
    const code='## Code\n```javascript\n  console.log("<tag>")\n\n```\n'
    data=await service.save('records',userId,null,{title:'Note',study_date:'2026-10-06',body_markdown:code,milestone_id:m,task_id:t},db)
    const note=data.records[0].record_id
    assert.equal((await service.getRecord(userId,note,db)).body_markdown,code)
    assert.equal(data.records[0].study_date,'2026-10-06')
    data=await service.save('records',userId,note,{input_mode:'plain'},db)
    assert.equal(data.records[0].input_mode,'plain');assert.equal((await service.getRecord(userId,note,db)).body_markdown,code)
    data=await service.save('records',userId,note,{input_mode:'markdown'},db)
    assert.equal((await service.getRecord(userId,note,db)).body_markdown,code)
    await assert.rejects(service.getRecord(other,note,db),{status:404})
    for(let i=0;i<21;i++)await service.save('records',userId,null,{milestone_id:m,task_id:t,title:'Page '+String(i).padStart(2,'0'),study_date:'2026-10-07',input_mode:i%2?'plain':'markdown',body_markdown:'FindMe %_ '+i},db)
    const page=await service.listRecords(userId,{task_id:t,page:'2',q:'FindMe'},db)
    assert.equal(page.total,21);assert.equal(page.records.length,5);assert.equal(page.page,2)
    assert.equal(page.records[0].body_markdown,undefined)
    assert.equal((await service.listRecords(userId,{q:'%_'},db)).total,21)
    assert.equal((await service.listRecords(userId,{task_id:t,mode:'plain'},db)).total,10)
    assert.equal((await service.listRecords(userId,{from:'2026-10-08'},db)).total,0)
    assert.equal((await service.listRecords(userId,{page:'999'},db)).page,5)
    assert.equal((await service.listRecords(other,{task_id:t},db)).total,0)
    const oldest=await service.listRecords(userId,{order:'oldest'},db);assert.equal(oldest.records[0].record_id,note)
    await assert.rejects(service.listRecords(userId,{page:'-1'},db),{status:400})
    await assert.rejects(service.listRecords(userId,{from:'2026-10-08',to:'2026-10-01'},db),{status:400})
    await client.query('DELETE FROM learning_records WHERE user_id=$1 AND record_id<>$2',[userId,note])
    data=await service.save('comments',userId,null,{record_id:note,block_start:1,block_source:'  x()\n',line_number:1,line_text:'  x()',body:'このコードの説明'},db)
    const comment=data.comments[0].comment_id
    assert.equal(data.comments[0].end_line,1)
    data=await service.save('comments',userId,null,{record_id:note,block_start:1,block_source:'a\n  b\nc\n',line_number:1,end_line:2,line_text:'a\n  b',body:'複数行の説明'},db)
    const rangeComment=data.comments.find(c=>c.comment_id!==comment)
    assert.equal(rangeComment.end_line,2);assert.equal(rangeComment.line_text,'a\n  b')
    await assert.rejects(service.save('comments',userId,null,{record_id:note,block_start:1,block_source:'a\n',line_number:1,end_line:2,line_text:'wrong',body:'Invalid'},db),{status:400})
    await service.remove('comments',userId,rangeComment.comment_id,db)
    await assert.rejects(service.save('comments',other,null,{record_id:note,block_start:1,block_source:'  x()\n',line_number:1,line_text:'  x()',body:'Forbidden'},db),{status:404})
    data=await service.save('comments',userId,comment,{body:'説明を更新'},db)
    assert.equal(data.comments[0].body,'説明を更新')
    await assert.rejects(service.save('comments',userId,comment,{record_id:note,body:'move'},db),{status:400})
    data=await service.save('records',userId,note,{body_markdown:code+'changed'},db)
    assert.equal(data.comments[0].block_source,'  x()\n')
    data=await service.save('records',userId,note,{body_markdown:code},db)
    // Exercise the actual HTTP router against the same isolated temporary DB.
    const express=require('express'),app=express(),originalQuery=dao.query,originalConnect=dao.pool.connect
    dao.query=db.query;dao.pool.connect=db.pool.connect
    app.use(express.json({limit:'1mb'}));app.use((req,res,next)=>{req.session={userId:req.headers['x-test-user']||userId};next()})
    app.use('/api/learning',require('../router/learningRouter'))
    const server=app.listen(0,'127.0.0.1')
    await new Promise(resolve=>server.once('listening',resolve))
    const origin=`http://127.0.0.1:${server.address().port}/api/learning`
    try {
      assert.equal((await fetch(origin)).status,200)
      assert.equal((await fetch(origin+'/records/'+note,{method:'PATCH',headers:{'Content-Type':'application/json','x-test-user':other},body:JSON.stringify({title:'Forbidden'})})).status,404)
      const response=await fetch(origin+'/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:other,title:'HTTP note',study_date:'2026-10-06',body_markdown:'学'.repeat(200000)})})
      assert.equal(response.status,200)
      const journal=(await response.json()).records.find(r=>r.title==='HTTP note')
      assert.equal(journal.user_id,userId);assert.equal((await (await fetch(origin+'/records/'+journal.record_id)).json()).body_markdown.length,200000)
      assert.equal((await (await fetch(origin+'/records?q=HTTP')).json()).total,1)
      assert.equal((await fetch(origin+'/records/'+journal.record_id,{method:'DELETE'})).status,200)
    } finally {await new Promise(resolve=>server.close(resolve));dao.query=originalQuery;dao.pool.connect=originalConnect}
    data=await service.save('records',userId,note,{milestone_id:m2},db)
    assert.equal(data.records[0].task_id,null)
    data=await service.save('records',userId,note,{milestone_id:m,task_id:t},db)
    data=await service.save('schedules',userId,null,{task_id:t,scheduled_date:'2026-10-06'},db)
    data=await service.save('schedules',userId,null,{task_id:t,scheduled_date:'2026-10-07'},db)
    assert.equal(data.schedules.length,2)
    data=await service.save('schedules',userId,data.schedules[0].schedule_id,{scheduled_date:'2026-10-08'},db)
    assert.equal(data.schedules[0].scheduled_date,'2026-10-08')
    data=await service.moveTask(userId,t,{milestone_id:m2},db)
    assert.equal(data.tasks.find(x=>x.task_id===t).milestone_id,m2)
    assert.equal(data.records.find(x=>x.record_id===note).milestone_id,m2)
    assert.equal(data.schedules.length,2)
    await assert.rejects(service.moveTask(other,t,{milestone_id:m},db),{status:404})
    data=await service.moveTask(userId,t,{milestone_id:m},db)
    data=await service.save('tasks',userId,t,{is_completed:true},db)
    assert.equal(data.tasks[0].is_completed,true)
    data=await service.save('tasks',userId,null,{milestone_id:m,title:'Temporary second task',start_date:'2026-10-01',target_date:'2026-10-10'},db)
    const secondTask=data.tasks.find(x=>x.task_id!==t).task_id
    data=await service.save('records',userId,null,{title:'Task deletion note',study_date:'2026-10-06',body_markdown:'Keep',milestone_id:m,task_id:secondTask},db)
    const secondNote=data.records.find(x=>x.record_id!==note).record_id
    data=await service.remove('tasks',userId,secondTask,db)
    assert.equal(data.records.find(x=>x.record_id===secondNote).milestone_id,m)
    assert.equal(data.records.find(x=>x.record_id===secondNote).task_id,null)
    await service.remove('records',userId,secondNote,db)
    assert.equal((await service.snapshot(other,db)).records.length,0)
    await assert.rejects(service.remove('records',other,note,db),{status:404})
    await client.query("SET LOCAL TIME ZONE 'America/Los_Angeles'")
    assert.equal((await service.snapshot(userId,db)).records[0].study_date,'2026-10-06')
    const ownEvent=(await client.query('INSERT INTO events(user_id) VALUES($1) RETURNING event_id',[userId])).rows[0].event_id
    await service.save('schedules',userId,null,{task_id:t,event_id:ownEvent,scheduled_date:'2026-10-09'},db)
    const otherEvent=(await client.query('INSERT INTO events(user_id) VALUES($1) RETURNING event_id',[other])).rows[0].event_id
    await assert.rejects(service.save('schedules',userId,null,{task_id:t,event_id:otherEvent,scheduled_date:'2026-10-09'},db),{status:400})
    data=await service.remove('roadmaps',userId,r,db)
    assert.equal(data.roadmaps.length,0);assert.equal(data.milestones.length,0);assert.equal(data.tasks.length,0);assert.equal(data.schedules.length,0)
    assert.equal(data.records.length,1);assert.equal(data.records[0].milestone_id,null);assert.equal(data.records[0].task_id,null);assert.equal((await service.getRecord(userId,note,db)).body_markdown,code)
    assert.equal(data.comments.length,1)
    data=await service.remove('records',userId,note,db)
    assert.equal(data.comments.length,0)
    assert.equal((await client.query('SELECT count(*)::int AS n FROM events')).rows[0].n,2)
  } finally {await client.query('ROLLBACK');client.release();await dao.pool.end()}
})
