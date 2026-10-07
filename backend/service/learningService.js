const dao = require('../database/DAO')
const { validDate } = require('../utils/validation')
const specs = {
  roadmaps: { table: 'learning_roadmaps', id: 'roadmap_id', fields: ['title','description','start_date','target_date'] },
  milestones: { table: 'learning_milestones', id: 'milestone_id', fields: ['roadmap_id','title','description','start_date','due_date','sort_order'] },
  tasks: { table: 'learning_tasks', id: 'task_id', fields: ['milestone_id','title','start_date','target_date','is_completed','sort_order'] },
  records: { table: 'learning_records', id: 'record_id', fields: ['milestone_id','task_id','study_date','title','body_markdown','input_mode'] },
  schedules: { table: 'learning_schedules', id: 'schedule_id', fields: ['task_id','event_id','scheduled_date'] },
  comments: { table:'learning_comments', id:'comment_id', fields:['record_id','block_start','block_source','line_number','end_line','line_text','body'] }
}
const error = (status, message) => Object.assign(new Error(message), { status })
function identifier(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || BigInt(value) > 9223372036854775807n) throw error(400,'選択内容を確認してください。')
  return String(value)
}
function normalize(kind, input) {
  const result = {}
  for (const key of specs[kind].fields) {
    const value = key==='end_line' ? input[key] ?? input.line_number : input[key]
    if (['block_start','line_number','end_line'].includes(key)) {
      if (!Number.isInteger(value)||value<(key==='block_start'?0:1)||value>200000) throw error(400,'コードの位置を確認してください。')
      result[key]=value
    } else if (['block_source','line_text','body'].includes(key)) {
      if(typeof value!=='string'||value.length>(key==='body'?10000:200000)||(key==='body'&&!value.trim()))throw error(400,'コメントは1〜10,000文字で入力してください。')
      result[key]=value
    } else if (key === 'title') {
      if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) throw error(400,'タイトルは1〜200文字で入力してください。')
      result[key] = value.trim()
    } else if (['description','body_markdown'].includes(key)) {
      if (typeof value !== 'string' || value.length > (key === 'body_markdown' ? 200000 : 10000)) throw error(400,'本文の長さを確認してください。')
      result[key] = value
    } else if (key === 'input_mode') {
      if (!['plain','markdown'].includes(value || 'markdown')) throw error(400,'入力形式を確認してください。')
      result[key] = value || 'markdown'
    } else if (key.endsWith('_date')) {
      if(kind==='tasks'&&!value){result[key]=null;continue}
      if (!validDate(value)) throw error(400,'開始日と締切日を入力してください。'); result[key] = value
    } else if (key === 'is_completed') {
      if (typeof value !== 'boolean') throw error(400,'完了状態を確認してください。')
      result[key] = value
    } else if (key === 'sort_order') {
      if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 2147483647)) throw error(400,'順序を確認してください。')
      if (value !== undefined) result[key] = value
    } else {
      const optional = kind === 'records' || key === 'event_id'
      result[key] = optional && !value ? null : identifier(value)
    }
  }
  if (kind === 'records' && !result.milestone_id) result.task_id = null
  if(kind==='comments'&&(result.end_line<result.line_number||result.end_line>result.block_source.replace(/\n$/,'').split('\n').length||result.line_text!==result.block_source.replace(/\n$/,'').split('\n').slice(result.line_number-1,result.end_line).join('\n')))throw error(400,'コードの選択範囲を確認してください。')
  if (['roadmaps','milestones'].includes(kind) && result.start_date > result[kind==='roadmaps'?'target_date':'due_date']) throw error(400,'締切日は開始日以降にしてください。')
  if(kind==='tasks'&&result.start_date&&result.target_date&&result.start_date>result.target_date)throw error(400,'目標日は開始日以降にしてください。')
  return result
}
function projection(spec) {
  // Cast DATE in SQL, before pg parses it, so date-only values never cross timezones.
  const dates = spec.fields.filter(k => k.endsWith('_date'))
  return dates.length ? `*, ${dates.map(k => `${k}::text AS ${k}`).join(', ')}` : '*'
}
async function snapshot(userId, db = dao) {
  const entries = []
  // A transaction has a single pg client; do not queue parallel queries on it.
  for (const [kind,spec] of Object.entries(specs)) {
    const select=kind==='records'?'record_id,user_id,milestone_id,task_id,study_date::text AS study_date,title,input_mode,created_at,updated_at':projection(spec)
    const result = await db.query(`SELECT ${select} FROM ${spec.table} WHERE user_id=$1 ORDER BY ${spec.id}`,[userId])
    entries.push([kind,result.rows])
  }
  return Object.fromEntries(entries)
}
async function owned(db, kind, userId, id) {
  const spec = specs[kind]
  const row = (await db.query(`SELECT ${projection(spec)} FROM ${spec.table} WHERE user_id=$1 AND ${spec.id}=$2`,[userId,identifier(id)])).rows[0]
  if (!row) throw error(404,'データが見つかりません。')
  return row
}
async function transaction(userId, callback, db = dao) {
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['learning:' + userId])
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (e) { await client.query('ROLLBACK'); throw e } finally { client.release() }
}
async function save(kind, userId, id, input, db = dao) {
  if (!Object.hasOwn(specs,kind)) throw error(404,'データが見つかりません。')
  const spec = specs[kind]
  if (!spec) throw error(404,'データが見つかりません。')
  return transaction(userId, async client => {
    const previous = id ? await owned(client,kind,userId,id) : {}
    if(kind==='comments'&&id&&Object.keys(input).some(k=>k!=='body'))throw error(400,'コメントの関連先は変更できません。')
    const data = normalize(kind,{ description:'', body_markdown:'', is_completed:false, ...previous, ...input })
    if(kind==='comments')await owned(client,'records',userId,data.record_id)
    if (kind === 'milestones') {
      const parent = await owned(client,'roadmaps',userId,data.roadmap_id)
      if (!parent.start_date || !parent.target_date || data.start_date < parent.start_date || data.due_date > parent.target_date) throw error(400,'小さな目標の期間は学習目標の期間内にしてください。')
    }
    if (kind === 'roadmaps' && id) {
      const outside = (await client.query('SELECT title FROM learning_milestones WHERE user_id=$1 AND roadmap_id=$2 AND (start_date IS NULL OR due_date IS NULL OR start_date<$3::date OR due_date>$4::date)',[userId,id,data.start_date,data.target_date])).rows
      if (outside.length) throw error(400,'先に小さな目標の期間を調整してください：'+outside.map(m=>m.title).join('、'))
    }
    if (kind === 'tasks') {await owned(client,'milestones',userId,data.milestone_id);if(!id&&(!data.start_date||!data.target_date))throw error(400,'開始日と目標日を入力してください。')}
    if (kind === 'records' && data.milestone_id) {
      await owned(client,'milestones',userId,data.milestone_id)
      if (data.task_id) {
        const task = await owned(client,'tasks',userId,data.task_id)
        if (String(task.milestone_id) !== data.milestone_id) data.task_id = null
      }
    }
    // Parent moves are done through a dedicated record editor; milestones/tasks keep their parent.
    if (id && ['milestones','tasks'].includes(kind)) {
      const key = kind === 'milestones' ? 'roadmap_id' : 'milestone_id'
      if (String(previous[key]) !== data[key]) throw error(400,'所属先は変更できません。')
    }
    if (kind === 'schedules') {
      await owned(client,'tasks',userId,data.task_id)
      if (data.event_id && !(await client.query('SELECT 1 FROM events WHERE user_id=$1 AND event_id=$2 AND NOT is_deleted',[userId,data.event_id])).rows.length) throw error(400,'予定が見つかりません。')
    }
    if (!id && ['milestones','tasks'].includes(kind)) {
      const parent = kind === 'milestones' ? 'roadmap_id' : 'milestone_id'
      data.sort_order = Number((await client.query(`SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM ${spec.table} WHERE user_id=$1 AND ${parent}=$2`,[userId,data[parent]])).rows[0].next)
    }
    const keys = Object.keys(data), values = keys.map(k => data[k])
    if (id) await client.query(`UPDATE ${spec.table} SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')},updated_at=CURRENT_TIMESTAMP WHERE user_id=$${keys.length+1} AND ${spec.id}=$${keys.length+2}`,[...values,userId,id])
    else await client.query(`INSERT INTO ${spec.table} (user_id,${keys.join(',')}) VALUES ($1,${keys.map((_,i)=>'$'+(i+2)).join(',')})`,[userId,...values])
    return snapshot(userId,client)
  },db)
}
async function remove(kind,userId,id,db = dao) {
  if (!Object.hasOwn(specs,kind)) throw error(404,'データが見つかりません。')
  const spec = specs[kind]
  if (!spec) throw error(404,'データが見つかりません。')
  return transaction(userId,async client => {
    await owned(client,kind,userId,id)
    await client.query(`DELETE FROM ${spec.table} WHERE user_id=$1 AND ${spec.id}=$2`,[userId,id])
    return snapshot(userId,client)
  },db)
}
async function reorder(userId,roadmapId,ids,db = dao) {
  return transaction(userId,async client => {
    await owned(client,'roadmaps',userId,roadmapId)
    if (!Array.isArray(ids) || ids.length > 1000) throw error(400,'順序を確認してください。')
    ids = ids.map(identifier)
    const actual = (await client.query('SELECT milestone_id FROM learning_milestones WHERE user_id=$1 AND roadmap_id=$2',[userId,roadmapId])).rows.map(r=>String(r.milestone_id))
    if (new Set(ids).size !== ids.length || actual.length !== ids.length || actual.some(id=>!ids.includes(id))) throw error(409,'一覧が変更されました。再読み込みしてください。')
    for (let i=0;i<ids.length;i++) await client.query('UPDATE learning_milestones SET sort_order=$1,updated_at=CURRENT_TIMESTAMP WHERE user_id=$2 AND milestone_id=$3',[i,userId,ids[i]])
    return snapshot(userId,client)
  },db)
}
async function listRecords(userId,input={},db=dao){
 const args=[userId],where=['user_id=$1']
 const add=(sql,value)=>{args.push(value);where.push(sql.replace('?',`$${args.length}`))}
 for(const key of ['milestone_id','task_id'])if(input[key])add(`${key}=?`,identifier(input[key]))
 if(input.q){if(typeof input.q!=='string'||input.q.length>200)throw error(400,'検索は200文字以内で入力してください。');add("(strpos(lower(title),lower(?))>0 OR strpos(lower(body_markdown),lower(?))>0)",input.q.trim());where[where.length-1]=where[where.length-1].replace('?',`$${args.length}`)}
 for(const [key,op] of [['from','>='],['to','<=']])if(input[key]){if(!validDate(input[key]))throw error(400,'日付を確認してください。');add(`study_date${op}?::date`,input[key])}
 if(input.from&&input.to&&input.from>input.to)throw error(400,'日付の範囲を確認してください。')
 if(input.mode){if(!['plain','markdown'].includes(input.mode))throw error(400,'入力形式を確認してください。');add('input_mode=?',input.mode)}
 if(input.order&&!['newest','oldest'].includes(input.order))throw error(400,'並び順を確認してください。')
 const requested=Number(input.page||1);if(!Number.isSafeInteger(requested)||requested<1)throw error(400,'ページを確認してください。')
 const filter=where.join(' AND '),direction=input.order==='oldest'?'ASC':'DESC'
 // One SQL statement gives count and page the same database snapshot.
 const result=await db.query(`WITH filtered AS (SELECT record_id,title,study_date,input_mode,milestone_id,task_id FROM learning_records WHERE ${filter}), total AS (SELECT count(*)::int AS count FROM filtered), page_data AS (SELECT *,study_date::text AS date_text FROM filtered ORDER BY study_date ${direction},record_id ${direction} LIMIT 5 OFFSET (LEAST($${args.length+1}::bigint,GREATEST(1,ceil((SELECT count FROM total)/5.0)::bigint))-1)*5) SELECT (SELECT count FROM total) AS total,COALESCE(json_agg(json_build_object('record_id',record_id::text,'title',title,'study_date',date_text,'input_mode',input_mode,'milestone_id',milestone_id::text,'task_id',task_id::text) ORDER BY study_date ${direction},record_id ${direction}) FILTER(WHERE record_id IS NOT NULL),'[]'::json) AS records FROM page_data`,[...args,requested])
 const row=result.rows[0],pages=Math.max(1,Math.ceil(row.total/5));return {records:row.records,total:row.total,page:Math.min(requested,pages),pages,pageSize:5}
}
async function getRecord(userId,id,db=dao){return owned(db,'records',userId,id)}
async function moveTask(userId,id,input,db=dao){return transaction(userId,async client=>{
 const task=await owned(client,'tasks',userId,id),source=await owned(client,'milestones',userId,task.milestone_id),destination=await owned(client,'milestones',userId,input.milestone_id)
 if(String(source.roadmap_id)!==String(destination.roadmap_id))throw error(400,'同じ学習目標の中で移動してください。')
 if(String(task.milestone_id)===String(destination.milestone_id))return snapshot(userId,client)
 await client.query('SET CONSTRAINTS ALL DEFERRED')
 const next=Number((await client.query('SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM learning_tasks WHERE user_id=$1 AND milestone_id=$2',[userId,destination.milestone_id])).rows[0].next)
 await client.query('UPDATE learning_tasks SET milestone_id=$1,sort_order=$2,updated_at=CURRENT_TIMESTAMP WHERE user_id=$3 AND task_id=$4',[destination.milestone_id,next,userId,id])
 await client.query('UPDATE learning_records SET milestone_id=$1,updated_at=CURRENT_TIMESTAMP WHERE user_id=$2 AND task_id=$3',[destination.milestone_id,userId,id])
 await client.query('SET CONSTRAINTS ALL IMMEDIATE')
 return snapshot(userId,client)
},db)}
module.exports = { snapshot, save, remove, reorder, normalize, identifier, listRecords, getRecord, moveTask }
