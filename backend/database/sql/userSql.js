const FIND_BY_GOOGLE_ID = `
  SELECT *
  FROM users
  WHERE google_id = $1
`

const INSERT_USER = `
  INSERT INTO users (
    google_id,
    email,
    user_name,
    profile_image
  )
  VALUES ($1, $2, $3, $4)
  RETURNING *
`
const FIND_BY_ID = `
  SELECT
    user_id,
    google_id,
    email,
    user_name,
    profile_image
  FROM users
  WHERE user_id = $1
`

module.exports = {
  FIND_BY_GOOGLE_ID,
  INSERT_USER,
  FIND_BY_ID
}