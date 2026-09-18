const userMapper = require('../database/mappers/userMapper')

async function getUserById(userId) {
  return await userMapper.findById(userId)
}

module.exports = {
  getUserById
}