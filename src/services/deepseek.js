// Simple DeepSeek API wrapper. Replace placeholders with real payload later.

const API_BASE = 'https://api.deepseek.com'
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY

export async function analyzeWithDeepseek({
  placeholderSummary = false,
  summaryText = '',
  model = 'deepseek-chat',
  temperature = 0.2,
  debug = false,
  paperPreview = '',
  isKnowledgeExtraction = false,
} = {}) {
  if (!API_KEY) {
    console.warn('未设置 VITE_DEEPSEEK_API_KEY，使用模拟数据')
    return mockResult()
  }
  
  console.log('开始调用DeepSeek API...')

  // Placeholder request; adjust to actual DeepSeek API contract you use
  try {
    const userPrompt = placeholderSummary
      ? '请基于示例生成一个学情分析摘要。'
      : `你是数学学科的学情分析助手。基于已计算的统计数据，提供教学建议和语义分析，输出严格 JSON（只返回 JSON），字段：\n- classOverview: [班级整体表现分析要点...]\n- knowledgeMastery: [知识点掌握情况分析要点...]\n\n要求：\n1. 基于提供的统计数据进行分析，不要重新计算数值\n2. 重点关注教学建议和问题诊断\n3. 提供针对性的改进建议\n4. 分析学习模式和趋势\n5. 对于重点关注学生，提供个性化的学习建议，包括：\n   - 具体薄弱知识点分析\n   - 提分策略（哪些知识点更容易提分）\n   - 学习重点排序\n   - 可能的失分原因（粗心、基础不牢、方法不当等）\n\n【统计数据】\n${summaryText}\n\n【试卷知识点预览】\n${paperPreview}`

    const systemPrompt = isKnowledgeExtraction 
      ? '你是数学试卷分析专家，专门识别题目知识点。必须输出包含 questionKnowledgeMap 和 knowledgeDistribution 的 JSON 格式。'
      : '你是严谨的教育数据分析助手，所有回答必须是严格 JSON。'
    
    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    }

    if (debug) console.log('[DeepSeek] request', payload)

    const resp = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) throw new Error(`DeepSeek API 错误: ${resp.status}`)
    const data = await resp.json()
    if (debug) console.log('[DeepSeek] response', data)
    const content = data?.choices?.[0]?.message?.content || ''
    if (debug) console.log('[DeepSeek] content', content)
    // 内容期望为 JSON；若解析失败，降级到原有解析器
    try {
      const parsed = JSON.parse(safeJson(content))
      // 检查是否是知识点识别结果
      if (parsed.questionKnowledgeMap || parsed.knowledgeDistribution) {
        return parsed // 直接返回知识点识别结果
      }
      return normalizeParsed(parsed)
    } catch {
      return parseToSections(content)
    }
  } catch (e) {
    console.error('DeepSeek API 调用失败:', e)
    console.log('使用模拟数据作为备用方案')
    // Fallback to mock for UX continuity
    return mockResult()
  }
}

function parseToSections(text) {
  // Naive splitter; real impl can parse JSON from model
  const ov = extract(text, ['整体', '班级', '表现']) || '整体成绩稳定，分布略右偏。'
  const km = extract(text, ['知识点', '掌握']) || '函数与几何较弱，代数与统计较强。'
  const fs = extract(text, ['重点', '学生']) || '建议关注作答稳定性差的3-5名学生。'
  return {
    classOverview: splitToList(ov),
    knowledgeMastery: splitToList(km),
    focusStudents: splitToList(fs),
  }
}

function extract(text, keywords) {
  const lower = text.toLowerCase()
  for (const k of keywords) {
    const i = lower.indexOf(k.toLowerCase())
    if (i >= 0) return text.slice(i, i + 120)
  }
  return ''
}

function mockResult() {
  return {
    classOverview: [
      '平均分72.4，及格率78%，高分段占比提升',
      '低分段集中在少数学生，整体右偏分布',
    ],
    knowledgeMastery: [
      '一次函数、三角形性质、样本方差相对薄弱',
      '整式运算、方程掌握较好',
    ],
    focusStudents: [
      'A03：近三次测评波动较大，错因以粗心与审题偏差为主',
      'B17：几何题型失分集中，建议专项训练',
      'C21：基础分丢失较多，建议先稳固必会题',
    ],
  }
}

function safeJson(s) {
  // 去除可能包裹在 Markdown 代码块中的 JSON
  const m = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(s)
  return (m ? m[1] : s).trim()
}

function normalizeParsed(p) {
  const toList = (v) => {
    if (Array.isArray(v)) {
      if (v.length && typeof v[0] === 'object') {
        return v.map(formatObjectLine)
      }
      return v.map((x) => String(x))
    }
    if (typeof v === 'object' && v) {
      return [formatObjectLine(v)]
    }
    // split by common separators into bullet lines
    return splitToList(String(v || ''))
  }
  
  // 特殊处理 knowledgeDetails，保持对象格式
  const processKnowledgeDetails = (v) => {
    if (Array.isArray(v)) {
      if (v.length && typeof v[0] === 'object') {
        return v // 直接返回对象数组
      }
      // 如果是字符串数组，尝试解析
      return v.map(item => {
        if (typeof item === 'string') {
          try {
            return JSON.parse(item)
          } catch {
            return { knowledgePoint: item, questionNumbers: '', coveragePercent: 0, averageScore: 0, masteryLevel: '', evidence: '' }
          }
        }
        return item
      })
    }
    return []
  }
  
  return {
    classOverview: toList(p.classOverview),
    knowledgeMastery: toList(p.knowledgeMastery),
    focusStudents: toList(p.focusStudents),
    knowledgeDetails: processKnowledgeDetails(p.knowledgeDetails),
  }
}

function formatObjectLine(o) {
  const name = o.name || o.student || o.id || o.code || ''
  const reason = o.reason || o.note || o.desc || ''
  const score = o.score != null ? `，分数/变化：${o.score}` : ''
  const extra = o.advice ? `，建议：${o.advice}` : ''
  const base = [name, reason].filter(Boolean).join('：')
  return base ? base + score + extra : JSON.stringify(o)
}

function splitToList(s) {
  return s
    .split(/[；;\n\r]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}


