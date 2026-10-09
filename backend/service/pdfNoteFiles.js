const fs = require('node:fs/promises'),
  path = require('node:path'),
  { randomUUID } = require('node:crypto')
const { fail } = require('../utils/pdfNoteValidation')
const directory = path.resolve(
  process.env.PDF_STORAGE_DIR || path.join(__dirname, '../storage/pdf'),
)
const filename = (key, suffix = '') => path.join(directory, key + suffix + '.pdf')
function validate(bytes) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 5 ||
    bytes.length > 30 * 1048576 ||
    bytes.subarray(0, 5).toString() !== '%PDF-'
  )
    throw fail(400, 'PDFファイルを選択してください（最大30MB）。')
}
async function write(bytes) {
  validate(bytes)
  await fs.mkdir(directory, { recursive: true })
  const key = randomUUID()
  await fs.writeFile(filename(key), bytes, { flag: 'wx' })
  return key
}
async function discard(key) {
  await fs.unlink(filename(key)).catch((e) => {
    if (e.code !== 'ENOENT') throw e
  })
}
async function stageRemoval(key) {
  const moved = []
  try {
    for (const suffix of ['', '.ocr']) {
      const original = filename(key, suffix),
        staged = original + '.deleting'
      try {
        await fs.rename(original, staged)
        moved.push({ original, staged })
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
      }
    }
    return moved
  } catch (error) {
    await restore(moved)
    throw error
  }
}
async function restore(moved) {
  for (const file of moved) await fs.rename(file.staged, file.original)
}
async function finish(moved) {
  for (const file of moved)
    await fs.unlink(file.staged).catch(() => console.error('PDF deletion cleanup needed'))
}
module.exports = { directory, filename, validate, write, discard, stageRemoval, restore, finish }
