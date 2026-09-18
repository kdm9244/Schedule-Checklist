// Isolated browser-test fixtures. Not imported by the application; no Google/DB access.
const express = require('express')
const app = express()
app.use(require('cors')({ origin:'http://localhost:5182', credentials:true }))
app.use(express.json())
let items = [
  { checklist_id:'1', title:'資料を準備', is_completed:false, event_id:null, target_date:'2026-09-17' },
  { checklist_id:'2', title:'接続を確認', is_completed:true, event_id:null, target_date:'2026-09-17' }
], memo = '', nextId = 3
const events = [
  { id:'all', calendarId:'fixture', summary:'複数日の研修', start:{date:'2026-09-16'},end:{date:'2026-09-19'} },
  { id:'timed', calendarId:'fixture', summary:'チーム打合せ', start:{dateTime:'2026-09-17T10:00:00+09:00'},end:{dateTime:'2026-09-17T11:00:00+09:00'} }
]
app.get('/api/users/me',(req,res) => res.json({ userName:'UI Test',email:'test@example.invalid' }))
app.get('/api/calendar/events',(req,res) => res.json(events.filter(e=>e.status!=='cancelled')))
events[0].description='<p>研修の<u>事前準備</u></p><ul><li>資料を読む</li><li>PCを持参</li></ul><a href="https://example.com">研修資料</a><script>alert("unsafe")</script><a href="javascript:alert(1)">危険なリンク</a>'
events.forEach(e=>{e.etag='v1';e.organizer={self:true}})
events.push({id:'readonly',calendarId:'readonly',summary:'共有・閲覧専用',etag:'v1',start:{date:'2026-09-17'},end:{date:'2026-09-19'}})
const management=require('../service/eventManageService')
const fakeGoogle={
  calendarList:{get:async({calendarId})=>({data:{id:calendarId,summary:'UI Test Calendar',accessRole:calendarId==='readonly'?'reader':'owner'}})},
  events:{
    get:async({eventId})=>{const e=events.find(e=>e.id===eventId);if(!e)throw {code:404};return {data:e}},
    patch:async({eventId,requestBody})=>{const e=events.find(e=>e.id===eventId);Object.assign(e,requestBody,{etag:'v'+Date.now()});return {data:e}},
    delete:async({eventId})=>{events.find(e=>e.id===eventId).status='cancelled'}
  }
}
const fakeDB={query:async(sql,args)=>({rows:sql.startsWith('SELECT')?items.filter(i=>args[1].includes(i.event_id)):[]})}
for(const [method,action] of [['get','getEvent'],['patch','updateEvent'],['delete','deleteEvent']]){
  app[method]('/api/calendar/event',async(req,res)=>{
    try{res.json(await management[action](1,{},method==='get'?req.query:req.body,{calendar:fakeGoogle,db:fakeDB}))}
    catch(e){res.status(e.status||e.code||502).json({message:e.message||'Test failure'})}
  })
}
app.post('/api/calendar/events',(req,res) => {
  const data = req.body
  const id = data.requestId
  if (!events.some(e => e.id === id)) {
    const next = new Date(data.date + 'T00:00:00Z'); next.setUTCDate(next.getUTCDate()+1)
    events.push({ id, calendarId:'fixture', summary:data.title,
      start:data.allDay ? { date:data.date } : { dateTime:data.date+'T'+data.startTime+':00+09:00' },
      end:data.allDay ? { date:next.toISOString().slice(0,10) } : { dateTime:data.date+'T'+data.endTime+':00+09:00' } })
    items.push(...data.checklists.map(item => ({ checklist_id:String(nextId++),title:item.title,is_completed:false,event_id:'fixture:'+id,target_date:data.date })))
  }
  res.status(201).json({ date:data.date,calendarId:'fixture',googleEventId:id })
})
app.get('/api/checklists',(req,res) => res.json(items.filter(i => !i.event_id && i.target_date === req.query.date)))
app.post('/api/checklists/event-batch',(req,res) => res.json(items.filter(i => req.body.keys.includes(i.event_id))))
app.post('/api/checklists',(req,res) => {
  const item = { checklist_id:String(nextId++), title:req.body.title, target_date:req.body.targetDate,event_id:req.body.eventId,is_completed:false }
  items.push(item);res.status(201).json(item)
})
app.put('/api/checklists/reorder',(req,res) => {
  const selected = req.body.ids.map(id => items.find(item => item.checklist_id === id))
  items = [...items.filter(item => !req.body.ids.includes(item.checklist_id)),...selected]
  res.json({success:true})
})
app.patch('/api/checklists/:id/status',(req,res) => {
  const item = items.find(i => i.checklist_id === req.params.id); item.is_completed = req.body.completed; res.json(item)
})
app.get('/api/memos/:date',(req,res) => res.json({content:memo}))
app.put('/api/memos/:date',(req,res) => { memo=req.body.content;res.json({content:memo}) })
app.listen(3099,'127.0.0.1',() => console.log('Isolated UI fixture API: 3099'))
