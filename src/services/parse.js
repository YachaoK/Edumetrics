// Lightweight parsing for CSV and optional XLSX (via dynamic import if available)

export async function parseFileToSummary(file) {
  const lower = (file?.name || '').toLowerCase()
  if (lower.endsWith('.csv')) {
    // 尝试不同的编码方式读取CSV文件
    let text
    try {
      // 首先尝试UTF-8
      text = await file.text()
      // 检查是否包含乱码
      if (text.includes('ѧ') || text.includes('')) {
        console.log('检测到编码问题，尝试重新读取...')
        // 如果包含乱码，尝试其他编码
        const arrayBuffer = await file.arrayBuffer()
        const decoder = new TextDecoder('gbk')
        text = decoder.decode(arrayBuffer)
      }
    } catch (e) {
      console.error('文件读取失败:', e)
      text = await file.text()
    }
    return summarizeCsv(text, file.name)
  }
  if (lower.endsWith('.xlsx')) {
    // 为避免在未安装依赖时的构建错误，这里不再尝试动态导入。
    // 如需解析 .xlsx，请先安装：npm i xlsx
    return `文件：${file.name}\n类型：.xlsx\n说明：未安装 xlsx 库，请先执行 npm i xlsx 以启用 Excel 解析。`
  }
  return `文件：${file?.name || '未命名'}\n类型：未知\n说明：不支持的格式。`
}

// 数学成绩CSV解析：返回 { rows, questionCount }
export function parseMathScoresCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return { rows: [], questionCount: 0 }
  const headers = splitCsvLine(lines[0])
  const fixed = ['学号','姓名','班级','考试名称','考试日期']
  const last = headers[headers.length - 1]
  const qStart = fixed.length
  const questionCount = Math.max(0, headers.length - fixed.length - 1)
  const rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line)
    const base = {
      id: cols[0] || '',
      name: cols[1] || '',
      className: cols[2] || '',
      exam: cols[3] || '',
      date: cols[4] || '',
    }
    const scores = []
    for (let i = 0; i < questionCount; i++) {
      const v = Number(cols[qStart + i])
      scores.push(Number.isFinite(v) ? v : 0)
    }
    const total = Number(cols[qStart + questionCount])
    return { ...base, scores, total: Number.isFinite(total) ? total : scores.reduce((a,b)=>a+b,0) }
  })
  return { rows, questionCount }
}

function summarizeCsv(text, fileName) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const headerLine = lines[0] || ''
  const headers = splitCsvLine(headerLine)
  const rows = lines.slice(1, 101).map(splitCsvLine)
  return summarizeCore(headers, rows, fileName)
}

function summarizeArray2D(arr, fileName, sheetName) {
  const headers = (arr[0] || []).map(String)
  const rows = arr.slice(1, 101).map((r) => r.map((v) => (v == null ? '' : String(v))))
  const base = summarizeCore(headers, rows, fileName)
  return base + `\n工作表：${sheetName}`
}

function summarizeCore(headers, rows, fileName) {
  const colCount = headers.length
  const rowCount = rows.length
  const numericStats = computeNumericStats(headers, rows)
  const previewRows = rows.slice(0, 5)
  const preview = [headers, ...previewRows]
    .map((r) => r.join('\t'))
    .join('\n')

  let statsText = ''
  if (numericStats.length) {
    const top = numericStats.slice(0, 3)
    statsText = top
      .map((s) => `${s.column}: 平均值=${formatNum(s.mean)} 样本数=${s.count}`)
      .join('；')
  } else {
    statsText = '未检测到明显的数值型列'
  }

  return `文件：${fileName}\n列数：${colCount} 行数（采样）：${rowCount}\n字段：${headers.join(', ')}\n数值统计（采样）：${statsText}\n前几行预览（制表符分隔）：\n${preview}`
}

function computeNumericStats(headers, rows) {
  const stats = []
  for (let c = 0; c < headers.length; c++) {
    let count = 0
    let sum = 0
    for (const row of rows) {
      const v = row[c]
      const num = Number(v)
      if (!Number.isNaN(num) && v !== '' && v != null) {
        count++
        sum += num
      }
    }
    if (count > 0) {
      stats.push({ column: headers[c] || `列${c + 1}` , count, mean: sum / count })
    }
  }
  // sort by count desc
  stats.sort((a, b) => b.count - a.count)
  return stats
}

function splitCsvLine(line) {
  // Basic CSV splitter (no full RFC 4180 quoting support). For robust cases, use PapaParse.
  // Handles simple commas and trims whitespace.
  return line
    .split(',')
    .map((s) => s.replace(/^\s+|\s+$/g, ''))
}

function formatNum(n) {
  return Number.isFinite(n) ? Number(n.toFixed(2)) : n
}


