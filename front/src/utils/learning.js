export function progress(tasks) {
  const completed=tasks.filter(t=>t.is_completed).length
  return {total:tasks.length,completed,percent:tasks.length?Math.round(completed/tasks.length*100):0,done:tasks.length>0&&completed===tasks.length}
}
