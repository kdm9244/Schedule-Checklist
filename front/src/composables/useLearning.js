import { reactive, readonly } from 'vue'
import axios from 'axios'
import { API_ORIGIN } from '../utils/http'
export { progress } from '../utils/learning'

const empty = () => ({ roadmaps:[], milestones:[], tasks:[], records:[], schedules:[], comments:[] })
const state = reactive({ ...empty(), loaded:false, loading:false, busy:false, error:'', schemaMissing:false, owner:'' })
const api = axios.create({ baseURL:API_ORIGIN + '/api/learning', withCredentials:true })
// Remove only the retired sample data and sample drafts; real-user drafts are preserved.
try {
  localStorage.removeItem('learning-demo-v1')
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('learning-draft-v1:demo:')) localStorage.removeItem(key)
  }
} catch { /* Storage restrictions must not prevent actual DB access. */ }
let pending,revision=0
export function learningError(error) {
  return error.response?.data?.message || (error.isAxiosError ? '接続を確認して、もう一度保存してください。' : error.message || '保存できませんでした。')
}
export const learningTemplate = '## 学んだ概念\n\n\n## 実習コード\n\n```javascript\n// ここにコードを書く\n```\n\n## 実行結果\n\n\n## エラーと解決\n\n\n## 次にやること\n\n'
function assign(data) {
  for (const key of Object.keys(empty())) {
    if(key==='records'){const cached=new Map(state.records.map(r=>[r.record_id,r]));state.records=(data.records||[]).map(r=>{const previous=cached.get(r.record_id);return previous?.updated_at===r.updated_at&&typeof previous.body_markdown==='string'?{...r,body_markdown:previous.body_markdown}:r})}
    else state[key]=data[key] || []
  }
}
async function load(force=false) {
  if (pending) return pending
  if (state.loaded && !force) return
  state.loading=true; state.error=''; state.schemaMissing=false
  const initialRevision=revision
  pending=(async()=>{
    await Promise.resolve()
    try {
      const [data,user] = await Promise.all([api.get('/'),axios.get(API_ORIGIN+'/api/users/me',{withCredentials:true})])
      if(revision===initialRevision)assign(data.data)
      state.owner=String(user.data.userId)
      state.loaded=true
    } catch(e) {
      state.schemaMissing=e.response?.data?.code==='LEARNING_SCHEMA_NOT_READY'
      state.error=e.response?.data?.message || 'データを読み込めませんでした。再試行してください。'
      throw e
    }
    finally { state.loading=false; pending=null }
  })()
  return pending
}
async function mutate(action) {
  if(state.busy) throw new Error('保存中です。')
  state.busy=true; state.error=''
  try {
    const data=await action()
    revision++;assign(data);return data
  } catch(e) {state.error=learningError(e); throw e}
  finally {state.busy=false}
}
async function save(kind,id,input) {
  return mutate(async()=> (await (id?api.patch(`/${kind}/${id}`,input):api.post(`/${kind}`,input))).data)
}
async function remove(kind,id) {
  return mutate(async()=> (await api.delete(`/${kind}/${id}`)).data)
}
async function reorder(roadmapId,ids) {
  return mutate(async()=> (await api.post('/milestones/reorder',{roadmap_id:roadmapId,ids})).data)
}
async function loadRecord(id){const {data}=await api.get('/records/'+id);state.records=state.records.map(r=>r.record_id===data.record_id?data:r);return data}
export function useLearning() { return {state:readonly(state),load,save,remove,reorder,loadRecord} }
