import { createContext, useContext, useMemo, useState } from 'react'

const UploadContext = createContext(null)

export function UploadProvider({ children }) {
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [dataSummary, setDataSummary] = useState('')
  const [paperFile, setPaperFile] = useState(null)
  const [paperFileName, setPaperFileName] = useState('')
  const [questionCount, setQuestionCount] = useState(0)
  const [scoreRows, setScoreRows] = useState([]) // [{id,name,class,exam,date,scores:Array,total}]
  const [knowledgeMap, setKnowledgeMap] = useState({}) // { '1': ['一次函数', ...] }
  const [knowledgeStats, setKnowledgeStats] = useState(null)

  const value = useMemo(() => ({
    uploadedFile,
    uploadedFileName,
    dataSummary,
    paperFile,
    paperFileName,
    questionCount,
    scoreRows,
    knowledgeMap,
    knowledgeStats,
    setUploadedFile,
    setUploadedFileName,
    setDataSummary,
    setPaperFile,
    setPaperFileName,
    setQuestionCount,
    setScoreRows,
    setKnowledgeMap,
    setKnowledgeStats,
  }), [uploadedFile, uploadedFileName, dataSummary, paperFile, paperFileName, questionCount, scoreRows, knowledgeMap, knowledgeStats])

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  )
}

export function useUpload() {
  const ctx = useContext(UploadContext)
  if (!ctx) throw new Error('useUpload must be used within UploadProvider')
  return ctx
}


