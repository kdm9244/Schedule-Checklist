// Tables copied from browsers commonly separate cells with tabs or newlines.
export function parseWordPaste(text) {
  const source = text.trim()
  if (!source) return null
  let cells
  if (source.includes('\t')) {
    const rows = text.split(/\r?\n/).filter((line) => line.trim())
    if (rows.length !== 1) throw Error('一度に表の1行を貼り付けてください。')
    cells = rows[0].split('\t').map((cell) => cell.trim())
  } else {
    cells = source
      .split(/\r?\n/)
      .map((cell) => cell.trim())
      .filter(Boolean)
    if (cells.length === 1) {
      const match = source.match(
        /^([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆ヶ・]+)\s+([\p{Script=Hiragana}\p{Script=Katakana}ー・]+)\s+(.+)$/u,
      )
      if (match) cells = match.slice(1)
      else {
        const two = source.match(/^(\S+)\s+([\p{Script=Hangul}].*)$/u)
        if (two) cells = [two[1], '', two[2]]
      }
    }
  }
  if (cells.length === 2) cells = [cells[0], '', cells[1]]
  if (cells.length !== 3 || !cells[0] || !cells[2])
    throw Error('単語・読み方・韓国語の意味の1行をコピーしてください。読み方は省略できます。')
  const [word, reading, meaning] = cells
  if (word.length > 200 || reading.length > 200 || meaning.length > 1000)
    throw Error('単語・読み方は200文字、意味は1000文字以内です。')
  return { word, reading, meaning }
}
