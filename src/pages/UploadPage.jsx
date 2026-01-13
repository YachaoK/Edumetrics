import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUpload } from '../context/UploadContext'
import { parseFileToSummary, parseMathScoresCsv } from '../services/parse'
import { getMathScoresTemplateCsv } from '../services/template'
import { extractPaperPreview } from '../services/paperExtract'

export default function UploadPage() {
  const navigate = useNavigate()
  const { setUploadedFile, setUploadedFileName, setDataSummary } = useUpload()
  const [localFileName, setLocalFileName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const { setPaperFile, setPaperFileName, paperFileName, setScoreRows, setQuestionCount, setKnowledgeMap } = useUpload()
  const [isPaperDragging, setIsPaperDragging] = useState(false)

  const isSupportedFile = (file) => {
    if (!file) return false
    const name = file.name?.toLowerCase() || ''
    return name.endsWith('.xlsx') || name.endsWith('.csv')
  }

  const handleFiles = useCallback(async (files) => {
    const file = files?.[0]
    if (!file) return
    if (!isSupportedFile(file)) {
      alert('仅支持 .xlsx 或 .csv 文件')
      return
    }
    setUploadedFile(file)
    setUploadedFileName(file.name)
    setLocalFileName(file.name)
    try {
      const summary = await parseFileToSummary(file)
      setDataSummary(summary)
    } catch (e) {
      setDataSummary(`文件：${file.name}\n摘要生成失败：${e?.message || '未知错误'}`)
    }
    // 解析数学成绩CSV为按题得分结构（.xlsx 暂不解析）
    try {
      if (file.name.toLowerCase().endsWith('.csv')) {
        // 尝试不同的编码方式读取CSV文件
        let text
        try {
          text = await file.text()
          // 检查是否包含乱码
          if (text.includes('ѧ') || text.includes('')) {
            console.log('检测到编码问题，尝试重新读取...')
            const arrayBuffer = await file.arrayBuffer()
            const decoder = new TextDecoder('gbk')
            text = decoder.decode(arrayBuffer)
          }
        } catch (e) {
          console.error('文件读取失败:', e)
          text = await file.text()
        }
        const { rows, questionCount } = parseMathScoresCsv(text)
        setScoreRows(rows)
        setQuestionCount(questionCount)
      } else {
        setScoreRows([])
        setQuestionCount(0)
      }
    } catch {}
  }, [setUploadedFile, setUploadedFileName, setDataSummary])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const dt = e.dataTransfer
    if (dt?.files?.length) {
      handleFiles(dt.files)
    }
  }, [handleFiles])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const onFileChange = useCallback((e) => {
    const files = e.target.files
    if (files?.length) {
      handleFiles(files)
      e.target.value = ''
    }
  }, [handleFiles])

  const onChooseClick = useCallback(() => {
    document.getElementById('file-input')?.click()
  }, [])

  const onChoosePaper = useCallback(() => {
    document.getElementById('paper-input')?.click()
  }, [])

  const isSupportedPaper = (file) => {
    if (!file) return false
    const type = (file.type || '').toLowerCase()
    const name = (file.name || '').toLowerCase()
    return (
      type.includes('pdf') ||
      type.startsWith('image/') ||
      name.endsWith('.doc') ||
      name.endsWith('.docx')
    )
  }

  const onPaperDrop = useCallback(async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsPaperDragging(false)
    const dt = e.dataTransfer
    const f = dt?.files?.[0]
    if (!f) return
    if (!isSupportedPaper(f)) {
      alert('仅支持 PDF、图片或 Word 文档')
      return
    }
    setPaperFile(f)
    setPaperFileName(f.name)
    // 尝试先抽取文本，后续将交给大模型做知识点识别
    try {
      const preview = await extractPaperPreview(f, { maxChars: 20000 })
      // 暂存为 knowledgeMap 的占位，后续由分析页调用大模型替换
      setKnowledgeMap({ __preview: preview })
    } catch {}
  }, [setPaperFile, setPaperFileName, setKnowledgeMap])

  return (
    <div className="app">
      <h1>学情分析助手EduMetrics</h1>

      {/* 顶部：题目数与模板下载（独占一行，避免影响下方两侧上传框的对齐）*/}
      <div className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <label htmlFor="qnum">题目数：</label>
        <input id="qnum" type="number" min={1} max={100} defaultValue={10} style={{ width: 100 }} />
        <button
          onClick={() => {
            const input = document.getElementById('qnum')
            const qn = Number(input?.value || 10)
            const csv = getMathScoresTemplateCsv(qn)
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `数学成绩模板_${qn}题.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          }}
        >
          下载成绩单模板
        </button>
      </div>

      {/* 中部：两个上传框同行顶部对齐 */}
      <div className="upload-layout">
        <div className="pane">
          <div
            className={`upload-dropzone${isDragging ? ' dragging' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onChooseClick()
            }}
            onClick={onChooseClick}
          >
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.csv"
              onChange={onFileChange}
              style={{ display: 'none' }}
            />
            <div className="upload-instructions">拖拽或选择成绩CSV上传</div>
            <div className="upload-hint">建议使用下载的“成绩单模板”填充后上传</div>
          </div>
          {localFileName && (
            <div className="uploaded-file">已上传：{localFileName}</div>
          )}
        </div>
        <div className="pane">
          <div
            className={`upload-dropzone${isPaperDragging ? ' dragging' : ''}`}
            role="button"
            tabIndex={0}
            onClick={onChoosePaper}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onChoosePaper() }}
            onDrop={onPaperDrop}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsPaperDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsPaperDragging(false) }}
          >
            <input
              id="paper-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) {
                  if (!isSupportedPaper(f)) {
                    alert('仅支持 PDF、图片或 Word 文档')
                  } else {
                    setPaperFile(f)
                    setPaperFileName(f.name)
                    try {
                      const preview = await extractPaperPreview(f)
                      setKnowledgeMap({ __preview: preview })
                    } catch {}
                  }
                }
                e.target.value = ''
              }}
              style={{ display: 'none' }}
            />
            <div className="upload-instructions">拖拽或选择试卷文件上传</div>
            <div className="upload-hint">支持：PDF、图片、Word</div>
          </div>
          {paperFileName && (
            <div className="uploaded-file">已上传：{paperFileName}</div>
          )}
        </div>
      </div>

      <div className="footer-actions">
        <button
          disabled={!localFileName}
          onClick={() => navigate('/analysis')}
        >
          开始智能分析
        </button>
      </div>
      
      {/* 版权信息 */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: '24px', 
        padding: '12px', 
        color: '#999', 
        fontSize: '12px',
        borderTop: '1px solid #eee'
      }}>
        @Nora's ModelLab
      </div>
    </div>
  )
}


