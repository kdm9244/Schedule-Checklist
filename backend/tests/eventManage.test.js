const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { getEvent,updateEvent,deleteEvent,validatePatch } = require('../service/eventManageService')
function fixture(overrides={}) {
  let event={id:'one',etag:'v1',summary:'Original',description:'<u>Keep HTML</u>',location:'',
    start:{date:'2026-09-18'},end:{date:'2026-09-20'},organizer:{self:true},attendees:[{email:'guest@example.invalid'}],...overrides}
  let failDB=false
  const calls=[], sql=[]
  const api={
    calendarList:{get:async()=>({data:{id:'calendar',accessRole:'owner'}})},
    events:{
      get:async()=>{if(!event)throw {code:410};return {data:structuredClone(event)}},
      patch:async(params,opts)=>{calls.push(['patch',params,opts]);event={...event,...params.requestBody,etag:'v2'};return {data:structuredClone(event)}},
      delete:async(params,opts)=>{calls.push(['delete',params,opts]);event=null}
    }
  }
  return {
    calendar:api,db:{query:async(q,args)=>{if(failDB){failDB=false;throw Error('DB unavailable')}sql.push([q,args]);return {rows:[]}}},
    calls,sql,event:()=>event,failDB:()=>{failDB=true}
  }
}
const input=()=>({calendarId:'calendar',eventId:'one',etag:'v1',operationId:randomUUID(),summary:'Changed',location:'Room',description:'Text',
  start:{date:'2026-09-19'},end:{date:'2026-09-22'}})
test('details expose permission and scope checklist lookup to current user',async()=>{
  const f=fixture()
  const e=await getEvent(42,{},input(),f)
  assert.equal(e.canEdit,true)
  assert.deepEqual(f.sql[0][1],[42,['calendar:one','one']])
})
test('update changes supported fields only and uses If-Match',async()=>{
  const f=fixture(),p=input()
  await updateEvent(42,{},p,f)
  assert.equal(f.calls[0][2].headers['If-Match'],'v1')
  assert.equal(f.calls[0][1].sendUpdates,'all')
  assert.equal('attendees' in f.calls[0][1].requestBody,false)
  assert.equal(f.event().attendees.length,1)
  assert.equal(f.sql.some(([q])=>/UPDATE checklists|DELETE FROM/.test(q)),false)
})
test('same-operation retry repairs DB without applying Google patch again',async()=>{
  const f=fixture(),p=input();f.failDB()
  await assert.rejects(updateEvent(42,{},p,f),/DB unavailable/)
  await updateEvent(42,{},p,f)
  assert.equal(f.calls.length,1)
  assert.equal(f.sql.length,1)
})
test('changed payload with same operation is rejected',async()=>{
  const f=fixture(),p=input();await updateEvent(42,{},p,f)
  await assert.rejects(updateEvent(42,{}, {...p,summary:'Other'},f),e=>e.status===409)
})
test('stale edits and stale deletions cannot overwrite changes',async()=>{
  for(const action of [updateEvent,deleteEvent]){
    const f=fixture({etag:'newer'})
    await assert.rejects(action(42,{},input(),f),e=>e.status===412)
    assert.equal(f.calls.length,0)
  }
})
test('read-only calendar cannot be modified',async()=>{
  const f=fixture();f.calendar.calendarList.get=async()=>({data:{id:'calendar',accessRole:'reader'}})
  assert.equal((await getEvent(42,{},input(),f)).canEdit,false)
  await assert.rejects(updateEvent(42,{},input(),f),e=>e.status===403)
  await assert.rejects(deleteEvent(42,{},input(),f),e=>e.status===403)
})
test('recurrence master is refused; instance can be edited without touching series',async()=>{
  await assert.rejects(updateEvent(42,{},input(),fixture({recurrence:['RRULE:FREQ=DAILY']})),e=>e.status===403)
  const f=fixture({recurringEventId:'master',originalStartTime:{date:'2026-09-18'}})
  await updateEvent(42,{},input(),f)
  assert.equal(f.calls[0][1].eventId,'one')
  assert.equal('recurrence' in f.calls[0][1].requestBody,false)
})
test('deletion stores snapshot and archives, preserving checklist and memo data',async()=>{
  const f=fixture();await deleteEvent(42,{},input(),f)
  assert.equal(f.calls[0][2].headers['If-Match'],'v1')
  assert.match(f.sql[0][0],/INSERT INTO events/)
  assert.match(f.sql[1][0],/is_deleted=true/)
  assert.deepEqual(f.sql[1][1],[42,'calendar:one'])
  assert.equal(f.sql.some(([q])=>/DELETE|UPDATE checklists|daily_memos/.test(q)),false)
  await deleteEvent(42,{},input(),f)
  assert.equal(f.calls.length,1)
})
test('missing access (404) must not mark local event deleted',async()=>{
  const f=fixture();f.calendar.events.get=async()=>{throw {code:404}}
  await assert.rejects(deleteEvent(42,{},input(),f),e=>e.code===404)
  assert.equal(f.sql.length,0)
})
test('validation rejects invalid ranges, mixed dates and unexpected time formats',()=>{
  for(const p of [{...input(),end:{date:'2026-09-18'}},{...input(),summary:''},
    {...input(),start:{dateTime:'2026-02-30T10:00:00Z'},end:{dateTime:'2026-03-02T11:00:00Z'}},
    {...input(),start:{dateTime:'2026-09-19T10:00:00'},end:{dateTime:'2026-09-19T11:00:00'}}]){
    assert.throws(()=>validatePatch(p),e=>e.status===400)
  }
})
test('switching between timed and all-day explicitly clears obsolete Google fields',()=>{
  const allDay=validatePatch(input())
  assert.equal(allDay.start.dateTime,null)
  const timed=validatePatch({...input(),start:{dateTime:'2026-09-18T10:00:00Z'},end:{dateTime:'2026-09-18T11:00:00Z'}})
  assert.equal(timed.start.date,null)
})
test('management HTTP routes require a logged-in Google session',async()=>{
  const app=require('express')()
  app.use(require('express').json())
  app.use((req,res,next)=>{req.session={};next()})
  app.use(require('../router/calendarRouter'))
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))})
  try{
    for(const method of ['GET','PATCH','DELETE']){
      const response=await fetch('http://127.0.0.1:'+server.address().port+'/event',{method})
      assert.equal(response.status,401)
    }
  }finally{await new Promise(resolve=>server.close(resolve))}
})
