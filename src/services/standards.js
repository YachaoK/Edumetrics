// 标准化知识点清单与辅助工具

export const STANDARD_KNOWLEDGE_POINTS = [
  { id: 'G1_01', name: '20以内加减法', aliases: ['20以内计算'], keywords: ['凑十法', '进位加', '退位减'] },
  { id: 'G1_02', name: '认识图形', aliases: ['基本图形'], keywords: ['圆形', '正方形', '三角形', '长方形'] },
  { id: 'G1_03', name: '认识钟表', aliases: ['认识时间'], keywords: ['整点', '半点', '时钟分钟'] },

  { id: 'G2_01', name: '乘法口诀', aliases: ['九九表'], keywords: ['表内乘法', '乘法记忆'] },
  { id: 'G2_02', name: '长度单位', aliases: ['厘米米'], keywords: ['测量', '单位换算'] },
  { id: 'G2_03', name: '角的初步认识', aliases: ['角的概念'], keywords: ['直角', '锐角', '钝角'] },

  { id: 'G3_01', name: '两位数乘除法', aliases: ['多位数乘除'], keywords: ['竖式计算', '进位'] },
  { id: 'G3_02', name: '分数初步', aliases: ['认识分数'], keywords: ['几分之一', '分数大小'] },
  { id: 'G3_03', name: '长方形面积', aliases: ['面积计算'], keywords: ['长乘宽', '面积公式'] },

  { id: 'G4_01', name: '小数加减', aliases: ['小数计算'], keywords: ['小数点', '数位对齐'] },
  { id: 'G4_02', name: '三角形特性', aliases: ['三角形性质'], keywords: ['内角和', '三角形分类'] },
  { id: 'G4_03', name: '统计图表', aliases: ['数据统计'], keywords: ['条形图', '数据分析'] },

  { id: 'G5_01', name: '分数乘除', aliases: ['分数运算'], keywords: ['约分', '通分', '最简分数'] },
  { id: 'G5_02', name: '平行四边形面积', aliases: ['多边形面积'], keywords: ['底乘高', '面积推导'] },
  { id: 'G5_03', name: '简易方程', aliases: ['一元一次方程'], keywords: ['解方程', '等式性质'] },

  { id: 'G6_01', name: '比例应用', aliases: ['比例问题'], keywords: ['比例尺', '正比例', '反比例'] },
  { id: 'G6_02', name: '圆的周长面积', aliases: ['圆的计算'], keywords: ['圆周率', '半径直径'] },
  { id: 'G6_03', name: '立体图形', aliases: ['空间几何'], keywords: ['长方体', '圆柱体', '体积计算'] },
]

export function buildStandardIndex(list = STANDARD_KNOWLEDGE_POINTS) {
  const norm = (s) => String(s || '').trim().toLowerCase()
  const nameToCanonical = new Map()
  const aliasToCanonical = new Map()
  const canonicalNames = new Set()

  for (const item of list) {
    const name = item.name
    const n = norm(name)
    canonicalNames.add(name)
    nameToCanonical.set(n, name)
    for (const a of item.aliases || []) {
      aliasToCanonical.set(norm(a), name)
    }
  }

  return { norm, nameToCanonical, aliasToCanonical, canonicalNames }
}

export function normalizeToStandard(label, index) {
  if (!label) return null
  const n = index.norm(label)
  return (
    index.nameToCanonical.get(n) ||
    index.aliasToCanonical.get(n) ||
    null
  )
}

export function normalizeKpArray(arr, index) {
  const out = []
  for (const x of Array.isArray(arr) ? arr : []) {
    const canon = normalizeToStandard(x, index)
    if (canon && !out.includes(canon)) out.push(canon)
    if (out.length >= 2) break
  }
  return out
}

export function whitelistQuestionKnowledgeMap(map, index) {
  const cleaned = {}
  const unknown = new Set()
  for (const [q, list] of Object.entries(map || {})) {
    const normed = normalizeKpArray(list, index)
    if (normed.length > 0) {
      cleaned[q] = normed
    } else if (Array.isArray(list) && list.length) {
      list.forEach((l) => unknown.add(l))
    }
  }
  return { cleaned, unknown: Array.from(unknown) }
}

export function stringifyStandardList(list = STANDARD_KNOWLEDGE_POINTS) {
  return list.map((it, i) => `${i + 1}. ${it.name}`).join('\n')
}





