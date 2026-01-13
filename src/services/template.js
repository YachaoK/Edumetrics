// 数学学科专用：生成“按题得分+总分”的 CSV 模板（UTF-8, 逗号分隔）
// 表头：学号, 姓名, 班级, 考试名称, 考试日期, 题1, 题2, ..., 题N, 总分
export function getMathScoresTemplateCsv(numQuestions = 10) {
  const fixed = ['学号','姓名','班级','考试名称','考试日期']
  const questions = Array.from({ length: Math.max(1, Number(numQuestions) || 10) }, (_, i) => `题${i + 1}`)
  const headers = [...fixed, ...questions, '总分']

  // 示例：两名学生，题目数与总分仅示范用
  const qn = questions.length
  const ex1 = new Array(qn).fill(0).map((_, i) => (i < 3 ? [8,7,9][i] : 0)) // 前三题示例分
  const ex2 = new Array(qn).fill(0).map((_, i) => (i < 3 ? [5,6,4][i] : 0))
  const rows = [
    ['A001','张三','初二1班','期中考试','2025-05-10', ...ex1, ex1.reduce((a,b)=>a+b,0)],
    ['A002','李四','初二1班','期中考试','2025-05-10', ...ex2, ex2.reduce((a,b)=>a+b,0)],
  ]

  return toCsv([headers, ...rows])
}

function toCsv(matrix) {
  return matrix
    .map((row) => row.map(csvCell).join(','))
    .join('\n')
}

function csvCell(v) {
  const s = String(v == null ? '' : v)
  if (/[",\n]/.test(s)) {
    // 需要转义：用双引号包裹，并把内部双引号翻倍
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}


