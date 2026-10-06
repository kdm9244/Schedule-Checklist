import {test} from 'node:test'
import assert from 'node:assert/strict'
import {progress} from './learning.js'
test('learning progress requires tasks; journal writing cannot complete an empty milestone',()=>{
  assert.deepEqual(progress([]),{total:0,completed:0,percent:0,done:false})
  assert.equal(progress([{is_completed:true},{is_completed:false},{is_completed:false}]).percent,33)
  assert.equal(progress([{is_completed:true},{is_completed:true}]).done,true)
  assert.equal(progress([{is_completed:true},{is_completed:false}]).done,false)
})
