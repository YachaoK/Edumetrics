// 由题号→知识点映射与按题得分，汇总知识点占比与强弱

export function aggregateKnowledge({ questionCount, scoreRows, knowledgeMap }) {
  // knowledgeMap: { '1': ['一次函数', '方程'], '2': ['三角形'], ... }
  // 如果 knowledgeMap 包含 __preview，说明还未解析，返回空数组
  if (knowledgeMap && knowledgeMap.__preview) return []
  
  const totals = {} // { kp: { count, sumScore } }
  const appearances = {} // { kp: number of questions tagged }
  for (let q = 1; q <= questionCount; q++) {
    const tags = knowledgeMap?.[String(q)] || []
    if (!tags.length) continue
    const idx = q - 1
    let avg = 0
    let cnt = 0
    for (const row of scoreRows || []) {
      const s = row.scores?.[idx]
      if (Number.isFinite(s)) { avg += s; cnt++ }
    }
    const mean = cnt ? avg / cnt : 0
    for (const kp of tags) {
      appearances[kp] = (appearances[kp] || 0) + 1
      const t = totals[kp] || { count: 0, sumScore: 0 }
      t.count += 1
      t.sumScore += mean
      totals[kp] = t
    }
  }

  const list = Object.entries(totals).map(([kp, v]) => ({
    knowledgePoint: kp,
    questions: appearances[kp] || v.count,
    avgScorePerQuestion: v.count ? Number((v.sumScore / v.count).toFixed(2)) : 0,
  }))
  list.sort((a, b) => a.avgScorePerQuestion - b.avgScorePerQuestion)
  return list
}


