// 统计计算工具：基于成绩数据和知识点映射计算准确统计信息

export function calculateKnowledgeStats(scoreRows, knowledgeMap) {
  if (!scoreRows || !knowledgeMap || Object.keys(knowledgeMap).length <= 1) {
    return []
  }

  // 按知识点分组题目
  const knowledgeGroups = {}
  
  Object.entries(knowledgeMap).forEach(([questionNum, knowledgePoints]) => {
    if (Array.isArray(knowledgePoints)) {
      knowledgePoints.forEach(kp => {
        if (!knowledgeGroups[kp]) {
          knowledgeGroups[kp] = []
        }
        knowledgeGroups[kp].push(parseInt(questionNum))
      })
    }
  })

  // 计算每个知识点的统计信息
  const results = []
  
  Object.entries(knowledgeGroups).forEach(([knowledgePoint, questionNumbers]) => {
    const stats = calculateKnowledgePointStats(scoreRows, questionNumbers, knowledgePoint)
    results.push(stats)
  })

  // 按平均分从高到低排序
  return results.sort((a, b) => b.averageScore - a.averageScore)
}

function calculateKnowledgePointStats(scoreRows, questionNumbers, knowledgePoint) {
  const totalStudents = scoreRows.length
  const totalQuestions = questionNumbers.length
  
  // 计算每个知识点的统计信息
  let totalScore = 0
  let totalPossibleScore = 0
  let zeroScoreCount = 0
  const questionStats = []

  questionNumbers.forEach(questionNum => {
    const questionIndex = questionNum - 1 // 题目编号从1开始，数组索引从0开始
    let questionScore = 0
    let questionZeroCount = 0

    scoreRows.forEach(row => {
      const score = row.scores[questionIndex] || 0
      questionScore += score
      if (score === 0) {
        questionZeroCount++
      }
    })

    const questionAverage = questionScore / totalStudents
    totalScore += questionScore
    totalPossibleScore += totalStudents * 3 // 假设每题满分3分
    zeroScoreCount += questionZeroCount

    questionStats.push({
      questionNum,
      average: questionAverage,
      zeroCount: questionZeroCount
    })
  })

  const averageScore = totalScore / (totalStudents * totalQuestions)
  const coveragePercent = Math.round((totalQuestions / 20) * 100) // 假设总共20题
  const masteryLevel = getMasteryLevel(averageScore)
  const evidence = generateEvidence(questionStats, knowledgePoint)

  return {
    knowledgePoint,
    questionNumbers: questionNumbers.join('、'),
    coveragePercent,
    averageScore: Math.round(averageScore * 100) / 100,
    masteryLevel,
    evidence
  }
}

function getMasteryLevel(averageScore) {
  // 假设每题满分为3分，按满分比例划分等级
  const full = 3
  const ratio = full > 0 ? (averageScore / full) : 0
  if (ratio >= 0.9) return '优秀'
  if (ratio >= 0.8) return '良好'
  if (ratio >= 0.6) return '一般'
  return '需关注'
}

function generateEvidence(questionStats, knowledgePoint) {
  const evidenceParts = []
  
  questionStats.forEach(stat => {
    if (stat.zeroCount > 0) {
      evidenceParts.push(`题${stat.questionNum}中${stat.zeroCount}名学生得0分`)
    }
  })

  if (evidenceParts.length === 0) {
    return `${knowledgePoint}相关题目表现良好，无学生得0分`
  }

  return evidenceParts.join('，')
}

// 计算班级整体统计
export function calculateClassOverview(scoreRows) {
  if (!scoreRows || scoreRows.length === 0) {
    return {
      totalStudents: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passRate: 0
    }
  }

  const totalStudents = scoreRows.length
  const totalScores = scoreRows.map(row => row.total)
  const sum = totalScores.reduce((a, b) => a + b, 0)
  const averageScore = sum / totalStudents
  const highestScore = Math.max(...totalScores)
  const lowestScore = Math.min(...totalScores)
  const passCount = totalScores.filter(score => score >= 36).length // 假设60%为及格线
  const passRate = (passCount / totalStudents) * 100

  return {
    totalStudents,
    averageScore: Math.round(averageScore * 100) / 100,
    highestScore,
    lowestScore,
    passRate: Math.round(passRate * 100) / 100
  }
}

// 计算重点关注学生
export function calculateFocusStudents(scoreRows) {
  if (!Array.isArray(scoreRows) || scoreRows.length === 0) return []

  // 规则1：低于总分60%的学生（按每题3分估算总分）
  const below60 = new Set()
  for (const row of scoreRows) {
    const maxTotal = (Array.isArray(row.scores) ? row.scores.length : 0) * 3
    const threshold = maxTotal * 0.6
    if (maxTotal > 0 && (Number(row.total) || 0) <= threshold) {
      below60.add(row.id)
    }
  }

  // 规则2：全班倒数10%（至少1人）
  const sortedByTotal = [...scoreRows].sort((a, b) => (a.total || 0) - (b.total || 0))
  const bottomCount = Math.max(1, Math.ceil(sortedByTotal.length * 0.10))
  const bottomIds = new Set(sortedByTotal.slice(0, bottomCount).map(r => r.id))

  // 合并两类学生
  const targetIds = new Set([...below60, ...bottomIds])

  const focused = scoreRows
    .filter(row => targetIds.has(row.id))
    .map(row => ({
      name: row.name,
      id: row.id,
      total: row.total,
      weakQuestions: findWeakQuestions(row.scores),
      reason: generateStudentReason(row),
      advice: generateStudentAdvice(row)
    }))
    .sort((a, b) => (a.total || 0) - (b.total || 0))

  return focused
}

function findWeakQuestions(scores) {
  const weakQuestions = []
  scores.forEach((score, index) => {
    if (score === 0) {
      weakQuestions.push(index + 1)
    }
  })
  return weakQuestions
}

function generateStudentReason(row) {
  const weakQuestions = findWeakQuestions(row.scores)
  if (weakQuestions.length === 0) return '表现良好'
  
  const questionList = weakQuestions.join('、')
  return `题${questionList}得0分，共${weakQuestions.length}道题失分`
}

function generateStudentAdvice(row) {
  const weakQuestions = findWeakQuestions(row.scores)
  if (weakQuestions.length === 0) return '继续保持'
  
  // 分析失分模式
  const advice = analyzeWeaknessPattern(row.scores, weakQuestions)
  return advice
}

function analyzeWeaknessPattern(scores, weakQuestions) {
  // 分析失分模式，提供具体建议
  const patterns = []
  
  // 检查是否连续失分（可能表示某个知识点完全不会）
  const consecutiveGroups = findConsecutiveGroups(weakQuestions)
  if (consecutiveGroups.length > 0) {
    patterns.push(`连续失分题目：${consecutiveGroups.map(g => g.join('、')).join('，')}，建议系统学习相关知识点`)
  }
  
  // 检查是否分散失分（可能表示粗心或基础不牢）
  if (weakQuestions.length > 3 && consecutiveGroups.length === 0) {
    patterns.push('失分题目分散，建议加强基础训练和细心程度')
  }
  
  // 检查具体题目类型
  const earlyQuestions = weakQuestions.filter(q => q <= 10)
  const lateQuestions = weakQuestions.filter(q => q > 10)
  
  if (earlyQuestions.length > 0) {
    patterns.push(`前10题失分${earlyQuestions.length}道，建议加强基础计算能力`)
  }
  
  if (lateQuestions.length > 0) {
    patterns.push(`后10题失分${lateQuestions.length}道，建议加强逻辑推理和综合应用能力`)
  }
  
  // 根据失分数量给出不同建议
  if (weakQuestions.length <= 3) {
    patterns.push('失分较少，建议重点攻克这几道题，争取满分')
  } else if (weakQuestions.length <= 6) {
    patterns.push('失分适中，建议分阶段提升，先攻克基础题')
  } else {
    patterns.push('失分较多，建议全面复习，从基础开始系统学习')
  }
  
  return patterns.length > 0 ? patterns.join('；') : '建议全面复习薄弱环节'
}

function findConsecutiveGroups(numbers) {
  if (numbers.length === 0) return []
  
  const sorted = [...numbers].sort((a, b) => a - b)
  const groups = []
  let currentGroup = [sorted[0]]
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i-1] + 1) {
      currentGroup.push(sorted[i])
    } else {
      if (currentGroup.length >= 2) {
        groups.push([...currentGroup])
      }
      currentGroup = [sorted[i]]
    }
  }
  
  if (currentGroup.length >= 2) {
    groups.push(currentGroup)
  }
  
  return groups
}
