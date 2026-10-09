import axios from 'axios'
import { API_ORIGIN } from './http'
const client = axios.create({ baseURL: API_ORIGIN + '/api/words', withCredentials: true })
export const wordLibraryApi = {
  list: (params, signal) => client.get('/', { params, signal }).then((r) => r.data),
  update: (input) => client.patch('/', input).then((r) => r.data),
  mastery: (ids, mastered) => client.patch('/mastery', { ids, mastered }).then((r) => r.data),
  resetMastery: (filters) => client.patch('/mastery/reset', filters).then((r) => r.data),
  remove: (ids) => client.delete('/', { data: { ids } }).then((r) => r.data),
}
