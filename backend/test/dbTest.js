const dao = require('../database/DAO')

async function test() {
  try {
    const result = await dao.query('SELECT NOW()')

    console.log('DB 연결 성공')
    console.log(result.rows)
  } catch (error) {
    console.error('DB 연결 실패')
    console.error(error)
  } finally {
    await dao.pool.end()
  }
}

test()