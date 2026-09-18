const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const dao = require('../database/DAO')
const { createEvent } = require('../service/eventCreateService')
test('real PostgreSQL: create/retry, ownership, reorder, batch; all test data rolled back', { skip: process.env.RUN_DB_TEST !== '1' }, async () => {
  const client = await dao.pool.connect()
  const originalQuery = dao.query, originalConnect = dao.pool.connect
  let server
  try {
    await client.query('BEGIN')
    const user = await client.query(
      'INSERT INTO users (google_id,email,user_name) VALUES ($1,$2,$3) RETURNING user_id',
      ['test-' + randomUUID(), 'test@example.invalid', 'Temporary automated test']
    )
    const userId = user.rows[0].user_id
    const transactionClient = {
      query: (sql, args) => client.query(sql === 'BEGIN' ? 'SAVEPOINT test_request' : sql === 'COMMIT' ? 'RELEASE SAVEPOINT test_request' : sql === 'ROLLBACK' ? 'ROLLBACK TO SAVEPOINT test_request' : sql, args),
      release() {}
    }
    const googleEvents = new Map()
    const calendar = {
      calendarList: { get: async () => ({ data:{ id:'test@example.invalid',accessRole:'owner' } }) },
      events: {
        insert: async ({ requestBody }) => {
          if (googleEvents.has(requestBody.id)) throw { code:409 }
          googleEvents.set(requestBody.id, requestBody)
          return { data:requestBody }
        },
        get: async ({ eventId }) => { if(!googleEvents.has(eventId))throw {code:410};return {data:googleEvents.get(eventId)} },
        patch: async ({eventId,requestBody}) => {
          const event={...googleEvents.get(eventId),...requestBody,etag:'v2'}
          googleEvents.set(eventId,event);return {data:event}
        },
        delete: async ({eventId}) => { googleEvents.delete(eventId) }
      }
    }
    const payload = { title:'Temporary test', date:'2026-09-17', allDay:true, location:'', description:'', timeZone:'Asia/Tokyo',
      requestId:randomUUID(), checklists:[{ title:'First' },{ title:'Second' }] }
    const deps = { calendar, pool:{ connect:async () => transactionClient } }
    const result = await createEvent(userId, {}, payload, deps)
    await createEvent(userId, {}, payload, deps)
    const key = result.calendarId + ':' + result.googleEventId
    assert.equal((await client.query('SELECT * FROM events WHERE user_id=$1', [userId])).rows.length, 1)
    const items = (await client.query('SELECT * FROM checklists WHERE user_id=$1 ORDER BY sort_order', [userId])).rows
    assert.equal(items.length, 2)
    assert.deepEqual(items.map(row => row.title), ['First','Second'])
    dao.query = (sql,args) => client.query(sql,args)
    dao.pool.connect = async () => transactionClient
    const express = require('express'), app = express()
    app.use(express.json())
    app.use((req,res,next) => { req.session = { userId: req.headers['x-test-other-user'] ? '-1' : userId }; next() })
    app.use('/checklists', require('../router/checklistRouter'))
    server = await new Promise(resolve => { const s = app.listen(0,'127.0.0.1', () => resolve(s)) })
    const url = 'http://127.0.0.1:' + server.address().port + '/checklists'
    const post = (path,body,method='POST',headers={}) => fetch(url + path, { method, headers:{ 'Content-Type':'application/json', ...headers }, body:JSON.stringify(body) })
    const ids = items.map(row => row.checklist_id).reverse()
    // Event checklists belong to the event, not just the currently viewed day.
    assert.equal((await post('/reorder',{ ids, date:'2026-09-18', eventId:key },'PUT')).status,200)
    assert.deepEqual((await client.query('SELECT title FROM checklists WHERE user_id=$1 ORDER BY sort_order',[userId])).rows.map(r => r.title), ['Second','First'])
    assert.equal((await post('/reorder',{ ids, date:'2026-09-18', eventId:key },'PUT',{'x-test-other-user':'1'})).status,409)
    assert.equal((await post('/reorder',{ ids:[ids[0],ids[0]], date:'2026-09-18', eventId:key },'PUT')).status,400)
    assert.equal((await (await post('/event-batch',{ keys:[key] })).json()).length,2)
    assert.equal((await (await post('/event-batch',{ keys:[key] },'POST',{'x-test-other-user':'1'})).json()).length,0)
    const templates=require('../service/checklistTemplateService')
    await templates.create(userId,{title:'Weekday routine',daysOfWeek:[1,2,3,4,5],startDate:'2026-09-01'})
    await templates.materializeForDate(userId,'2026-09-17')
    await templates.materializeForDate(userId,'2026-09-17')
    const generated=await client.query('SELECT * FROM checklists WHERE user_id=$1 AND template_id IS NOT NULL',[userId])
    assert.equal(generated.rows.length,1)
    assert.equal(generated.rows[0].title,'Weekday routine')
    await templates.skipInstanceForChecklist(userId,generated.rows[0].checklist_id)
    await client.query('DELETE FROM checklists WHERE checklist_id=$1',[generated.rows[0].checklist_id])
    await templates.materializeForDate(userId,'2026-09-17')
    assert.equal((await client.query('SELECT * FROM checklists WHERE user_id=$1 AND template_id IS NOT NULL',[userId])).rows.length,0)
    const isoDay=offset=>{const date=new Date();date.setDate(date.getDate()+offset);return date.toISOString().slice(0,10)}
    const removable=await templates.create(userId,{title:'Temporary routine',daysOfWeek:[0,1,2,3,4,5,6],startDate:isoDay(-1)})
    await templates.materializeForDate(userId,isoDay(-1))
    await templates.materializeForDate(userId,isoDay(0))
    await templates.materializeForDate(userId,isoDay(1))
    const removed=await templates.remove(userId,removable.template_id)
    assert.equal(removed.removed_count,2)
    const savedDates=(await client.query('SELECT target_date::text AS target_date FROM checklists WHERE user_id=$1 AND template_id=$2',[userId,removable.template_id])).rows.map(row=>row.target_date)
    assert.deepEqual(savedDates,[isoDay(-1)])
    const controllable=await templates.create(userId,{title:'Controllable routine',daysOfWeek:[0,1,2,3,4,5,6],startDate:isoDay(-1)})
    await templates.materializeForDate(userId,isoDay(-1))
    await templates.materializeForDate(userId,isoDay(0))
    const currentGenerated=(await client.query('SELECT checklist_id FROM checklists WHERE user_id=$1 AND template_id=$2 AND target_date=CURRENT_DATE',[userId,controllable.template_id])).rows[0]
    await client.query('UPDATE checklists SET is_completed=TRUE WHERE checklist_id=$1',[currentGenerated.checklist_id])
    assert.equal((await client.query('SELECT COUNT(*)::integer AS count FROM checklists WHERE user_id=$1 AND template_id=$2 AND target_date=CURRENT_DATE',[userId,controllable.template_id])).rows[0].count,1)
    const stopped=await templates.update(userId,controllable.template_id,{active:false})
    assert.equal(stopped.removed_count,0)
    await templates.materializeForDate(userId,isoDay(0))
    const checklistService=require('../service/checklistService')
    assert.equal((await checklistService.getChecklistsByDate(userId,isoDay(0))).filter(item=>String(item.template_id)===String(controllable.template_id)).length,0)
    assert.equal((await checklistService.getChecklistsByDate(userId,isoDay(-1))).filter(item=>String(item.template_id)===String(controllable.template_id)).length,1)
    await templates.update(userId,controllable.template_id,{active:true})
    const restored=(await checklistService.getChecklistsByDate(userId,isoDay(0))).find(item=>String(item.checklist_id)===String(currentGenerated.checklist_id))
    assert.equal(restored.is_completed,true)
    const edited=await templates.update(userId,controllable.template_id,{title:'Updated routine',daysOfWeek:[0,1,2,3,4,5,6],startDate:isoDay(-1)})
    assert.equal(edited.removed_count,1)
    await templates.materializeForDate(userId,isoDay(0))
    assert.equal((await client.query('SELECT title FROM checklists WHERE user_id=$1 AND template_id=$2 AND target_date=CURRENT_DATE',[userId,controllable.template_id])).rows[0].title,'Updated routine')
    const {updateEvent,deleteEvent}=require('../service/eventManageService')
    googleEvents.get(result.googleEventId).etag='v1'
    const update={calendarId:result.calendarId,eventId:result.googleEventId,etag:'v1',operationId:randomUUID(),
      summary:'Updated title',location:'Room',description:'Updated description',start:{date:'2026-09-20'},end:{date:'2026-09-22'}}
    const manageDeps={calendar,db:{query:(sql,args)=>client.query(sql,args)}}
    await updateEvent(userId,{},update,manageDeps)
    assert.equal((await client.query('SELECT title FROM events WHERE user_id=$1',[userId])).rows[0].title,'Updated title')
    const preserved=(await client.query('SELECT * FROM checklists WHERE user_id=$1 AND event_id=$2 ORDER BY checklist_id',[userId,key])).rows
    assert.deepEqual(preserved.map(r=>[r.checklist_id,r.is_completed,r.target_date]),items.map(r=>[r.checklist_id,r.is_completed,r.target_date]))
    await deleteEvent(userId,{}, {...update,etag:'v2'},manageDeps)
    assert.equal((await client.query('SELECT is_deleted FROM events WHERE user_id=$1',[userId])).rows[0].is_deleted,true)
    assert.equal((await client.query('SELECT * FROM checklists WHERE user_id=$1 AND event_id=$2',[userId,key])).rows.length,2)
    await deleteEvent(userId,{}, {...update,etag:'v2'},manageDeps)
  } finally {
    if (server) await new Promise(resolve => server.close(resolve))
    dao.query = originalQuery; dao.pool.connect = originalConnect
    await client.query('ROLLBACK')
    client.release()
    await dao.pool.end()
  }
})
