import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUpload } from '../context/UploadContext'
import { analyzeWithDeepseek } from '../services/deepseek'
import { calculateKnowledgeStats, calculateClassOverview, calculateFocusStudents } from '../services/statsCalculator'
import { exportToPDF } from '../services/export'
import { aggregateKnowledge } from '../services/knowledge'
import { STANDARD_KNOWLEDGE_POINTS, buildStandardIndex, whitelistQuestionKnowledgeMap, stringifyStandardList } from '../services/standards'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// 分析学生薄弱知识点
function analyzeStudentWeakness(scores, knowledgeMap) {
  const weakQuestions = []
  scores.forEach((score, index) => {
    if (score === 0) {
      weakQuestions.push(index + 1)
    }
  })
  
  const weakKnowledgePoints = new Set()
  weakQuestions.forEach(questionNum => {
    const knowledgePoints = knowledgeMap[questionNum]
    if (Array.isArray(knowledgePoints)) {
      knowledgePoints.forEach(kp => weakKnowledgePoints.add(kp))
    }
  })
  
  return Array.from(weakKnowledgePoints)
}

export default function AnalysisPage() {
  const navigate = useNavigate()
  const { uploadedFileName, dataSummary, questionCount, scoreRows, knowledgeMap, setKnowledgeMap } = useUpload()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [knowledgeExtractionResult, setKnowledgeExtractionResult] = useState(null)

  const hasFile = useMemo(() => !!uploadedFileName, [uploadedFileName])
  const standardIndex = useMemo(() => buildStandardIndex(STANDARD_KNOWLEDGE_POINTS), [])

  const onAnalyze = async () => {
    setLoading(true)
    setError('')
    try {
      // 如果仅有抽取的预览而没有正式映射，则先调用大模型识别题号→知识点
      let currentKnowledgeMap = knowledgeMap
      let knowledgeDistribution = []
      if (knowledgeMap && knowledgeMap.__preview && (!knowledgeMap || Object.keys(knowledgeMap).length <= 1)) {
        const preview = knowledgeMap.__preview
        console.log('试卷预览文本:', preview)
        const prompt = `请从以下题目中，识别其所考察的核心知识点。知识点必须且只能从“标准知识点列表”中选择1个或2个，禁止创造新名称。只返回严格 JSON，字段必须包含 questionKnowledgeMap 和 knowledgeDistribution。

返回格式示例：
{
  "questionKnowledgeMap": {"1": ["小数加减"], "2": ["三角形特性"], "3": ["统计图表"], "4": ["分数乘除"]},
  "knowledgeDistribution": [{"knowledgePoint": "小数加减", "coveragePercent": 10}]
}

标准知识点列表：\n${stringifyStandardList(STANDARD_KNOWLEDGE_POINTS)}

试卷文本：\n${preview}`
        // 使用专门的知识点识别调用，避免与学情分析混淆
        const kmRes = await analyzeWithDeepseek({ 
          placeholderSummary: false, 
          summaryText: prompt, 
          debug: true,
          isKnowledgeExtraction: true // 标记这是知识点识别
        })
        console.log('知识点识别结果:', kmRes)
        console.log('原始响应内容:', kmRes)
        if (kmRes && kmRes.questionKnowledgeMap) {
          // 结果白名单化（映射到标准清单）
          const { cleaned, unknown } = whitelistQuestionKnowledgeMap(kmRes.questionKnowledgeMap, standardIndex)
          currentKnowledgeMap = cleaned
          // 保存到上下文中
          setKnowledgeMap(cleaned)
          if (unknown && unknown.length) {
            console.log('存在未匹配到标准清单的知识点（已忽略）:', unknown)
          }
          console.log('已保存知识点映射(标准化):', cleaned)
        } else {
          console.log('未识别出知识点映射')
        }
        if (kmRes && kmRes.knowledgeDistribution) {
          knowledgeDistribution = kmRes.knowledgeDistribution
          setKnowledgeExtractionResult(kmRes)
        }
      }

      // 使用代码计算准确的统计数据
      const classStats = calculateClassOverview(scoreRows)
      const focusStudents = calculateFocusStudents(scoreRows)
      const knowledgeDetails = calculateKnowledgeStats(scoreRows, currentKnowledgeMap)
      
      console.log('计算得出的班级统计:', classStats)
      console.log('计算得出的重点关注学生:', focusStudents)
      console.log('计算得出的知识点详情:', knowledgeDetails)
      
      // 基于知识点映射补充每位学生的薄弱知识点
      const enhancedFocusStudents = focusStudents.map(student => ({
        ...student,
        weakKnowledgePoints: analyzeStudentWeakness(
          scoreRows.find(row => row.id === student.id)?.scores || [], 
          currentKnowledgeMap
        )
      }))
      // 不再为学生生成个性化建议

      // 只让大模型做语义分析，不做数值计算
      const semanticAnalysis = await analyzeWithDeepseek({
        placeholderSummary: false,
        summaryText: `班级统计：${JSON.stringify(classStats)}\n重点关注学生：${JSON.stringify(enhancedFocusStudents.map(({ name, id, total, weakKnowledgePoints }) => ({ name, id, total, weakKnowledgePoints })))}\n（不再包含个性化建议）`,
        model: 'deepseek-chat',
        temperature: 0.2,
        debug: true,
        paperPreview: JSON.stringify(currentKnowledgeMap || {}),
      })
      
      // 合并代码计算结果和大模型分析结果
      const res = {
        ...semanticAnalysis,
        knowledgeDetails, // 使用代码计算的准确数据
        classStats, // 添加代码计算的班级统计
        focusStudents: enhancedFocusStudents // 新版列表
      }
      
      setResult(res)
      console.log('最终分析结果:', res)
      
      // 如果没有knowledgeDetails，尝试从现有数据生成
      if (!res?.knowledgeDetails && knowledgeExtractionResult?.knowledgeDistribution) {
        console.log('尝试从现有数据生成knowledgeDetails')
        const generatedDetails = knowledgeExtractionResult.knowledgeDistribution.map(item => ({
          knowledgePoint: item.knowledgePoint,
          questionNumbers: '待分析',
          coveragePercent: item.coveragePercent,
          averageScore: '待计算',
          masteryLevel: '待评估',
          evidence: '数据生成中'
        }))
        res.knowledgeDetails = generatedDetails
        setResult({...res, knowledgeDetails: generatedDetails})
        console.log('生成的knowledgeDetails:', generatedDetails)
      }
    } catch (e) {
      setError(e?.message || '分析失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }
  const basicStats = useMemo(() => {
    if (!scoreRows?.length) return null
    const totals = scoreRows.map((r) => Number(r.total) || 0)
    const max = Math.max(...totals)
    const min = Math.min(...totals)
    const avg = totals.reduce((a,b)=>a+b,0) / totals.length
    return { max, min, avg: Number(avg.toFixed(2)) }
  }, [scoreRows])

  const kpStats = useMemo(() => {
    if (!questionCount || !scoreRows?.length || !knowledgeMap) return []
    // 如果 knowledgeMap 包含 __preview，说明还未解析，返回空数组
    if (knowledgeMap && knowledgeMap.__preview) return []
    return aggregateKnowledge({ questionCount, scoreRows, knowledgeMap })
  }, [questionCount, scoreRows, knowledgeMap])

  const onExport = async () => {
    if (!result) return
    try {
      await exportToPDF(result, uploadedFileName || '未命名文件')
    } catch (error) {
      console.error('导出失败:', error)
      alert('导出失败：' + (error.message || '未知错误'))
    }
  }

  // 进入页面后自动触发分析（有文件且未有结果时）
  useEffect(() => {
    if (hasFile && !loading && !result) {
      onAnalyze()
    }
  }, [hasFile, loading, result])

  return (
    <div className="app">
      <h1>学情分析结果</h1>
      {!hasFile && (
        <div style={{ color: '#666' }}>尚未上传文件，请先返回上传页。</div>
      )}

      <div style={{ marginTop: 8, color: '#333' }}>文件：{uploadedFileName || '—'}</div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => navigate('/')}>返回上传页</button>
        <button disabled={!result} onClick={onExport}>导出报告</button>
      </div>

      {loading && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: '#eef3ff', border: '1px solid #cddaFF', borderRadius: 6, color: '#334' }}>
          AI大模型分析中… 请稍候
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 960, marginTop: 24, display: 'grid', gap: 16 }}>
        <section className="panel">
          <h2>班级整体表现</h2>
          {result?.classStats ? (
            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
              <div><strong>学生总数：</strong>{result.classStats.totalStudents}人</div>
              <div><strong>平均分：</strong>{result.classStats.averageScore}分</div>
              <div><strong>最高分：</strong>{result.classStats.highestScore}分</div>
              <div><strong>最低分：</strong>{result.classStats.lowestScore}分</div>
              <div><strong>及格率：</strong>{result.classStats.passRate}%</div>
            </div>
          ) : basicStats && (
            <div style={{ marginBottom: 8 }}>
              最高分：{basicStats.max}　最低分：{basicStats.min}　平均分：{basicStats.avg}
            </div>
          )}
          {Array.isArray(result?.classOverview) ? (
            <ul style={{ textAlign: 'left' }}>
              {result.classOverview.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <div>{loading ? 'AI大模型分析中…' : (result?.classOverview || '点击“查看详细分析”后展示')}</div>
          )}
        </section>
        <section className="panel">
          <h2>知识点掌握情况</h2>
          {result?.knowledgeDetails && result.knowledgeDetails.length > 0 ? (
            <div>
              {/* 数据表格 */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ textAlign: 'left', padding: '8px', border: '1px solid #ddd', width: '120px' }}>知识点</th>
                    <th style={{ textAlign: 'left', padding: '8px', border: '1px solid #ddd', width: '150px' }}>涉及该知识点的题号</th>
                    <th style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', width: '80px' }}>题目占比</th>
                    <th style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', width: '80px' }}>平均分</th>
                    <th style={{ textAlign: 'left', padding: '8px', border: '1px solid #ddd', width: '100px' }}>掌握强度</th>
                    <th style={{ textAlign: 'left', padding: '8px', border: '1px solid #ddd', width: '200px' }}>依据</th>
                  </tr>
                </thead>
                <tbody>
                  {result.knowledgeDetails
                    .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
                    .map((item, i) => (
                    <tr key={i}>
                      <td style={{ padding: '8px', border: '1px solid #ddd', width: '120px' }}>{item.knowledgePoint}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', width: '150px' }}>{item.questionNumbers}</td>
                      <td style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', width: '80px' }}>{item.coveragePercent}%</td>
                      <td style={{ textAlign: 'right', padding: '8px', border: '1px solid #ddd', width: '80px' }}>{item.averageScore}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', width: '100px' }}>{item.masteryLevel}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd', width: '200px' }}>{item.evidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* 图表展示区域 */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
                gap: '24px', 
                marginTop: '24px',
                marginBottom: '24px' 
              }}>
                {/* 饼图：题目占比 */}
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '16px', marginBottom: '20px', textAlign: 'center', fontWeight: 600 }}>知识点题目占比分布</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                      <Pie
                        data={result.knowledgeDetails.map(item => ({
                          name: item.knowledgePoint,
                          value: item.coveragePercent || 0
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        outerRadius={90}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {result.knowledgeDetails.map((entry, index) => {
                          const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82CA9D', '#FFC658', '#FF7C7C']
                          return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        })}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* 柱状图：平均分 */}
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: '16px', marginBottom: '20px', textAlign: 'center', fontWeight: 600 }}>知识点平均分对比</h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart
                      data={result.knowledgeDetails
                        .sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0))
                        .map(item => ({
                          name: item.knowledgePoint.length > 8 ? item.knowledgePoint.substring(0, 8) + '...' : item.knowledgePoint,
                          fullName: item.knowledgePoint,
                          平均分: item.averageScore || 0
                        }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={120}
                        interval={0}
                      />
                      <YAxis 
                        label={{ value: '平均分', angle: -90, position: 'insideLeft' }}
                        domain={[0, 'dataMax']}
                      />
                      <Tooltip 
                        formatter={(value) => [`${value.toFixed(2)}分`, '平均分']}
                        labelFormatter={(label, payload) => payload[0]?.payload?.fullName || label}
                      />
                      <Bar dataKey="平均分" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {Array.isArray(result?.knowledgeMastery) ? (
                <ul style={{ textAlign: 'left' }}>
                  {result.knowledgeMastery.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              ) : (
                <div>{loading ? 'AI大模型分析中…' : (result?.knowledgeMastery || '点击"查看详细分析"后展示')}</div>
              )}
            </div>
          )}
          {/* 同时在表格模式下补充展示模型语义要点 */}
          {(result?.knowledgeDetails && result.knowledgeDetails.length > 0 && Array.isArray(result?.knowledgeMastery) && result.knowledgeMastery.length > 0) ? (
            <div style={{ marginTop: '12px', textAlign: 'left' }}>
              <div style={{ fontWeight: 600, marginBottom: '6px' }}>模型分析要点</div>
              <ul>
                {result.knowledgeMastery.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
        <section className="panel">
          <h2>重点关注的学生</h2>
          {Array.isArray(result?.focusStudents) && result.focusStudents.length > 0 ? (
            <div>
              {result.focusStudents.map((student, i) => (
                <div key={i} style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
                  <div><strong>{student.name} ({student.id})</strong> - 总分：{student.total}分</div>
                  {/* 失分题目（一次）+ 数量 + 相关知识点 */}
                  {(student.weakQuestions?.length > 0 || (student.weakKnowledgePoints && student.weakKnowledgePoints.length > 0)) && (
                    <div style={{ marginTop: '4px', fontSize: '14px' }}>
                      {student.weakQuestions?.length > 0 && (
                        <span>
                          失分题目：题{student.weakQuestions.join('、')}（共{student.weakQuestions.length}道）；
                        </span>
                      )}
                      {student.weakKnowledgePoints && student.weakKnowledgePoints.length > 0 && (
                        <span style={{ color: '#e74c3c' }}>相关知识点：{student.weakKnowledgePoints.join('、')}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div>{loading ? 'AI大模型分析中…' : (result?.focusStudents || '点击"查看详细分析"后展示')}</div>
          )}
        </section>
      </div>

      {error && <div style={{ color: 'crimson', marginTop: 12 }}>{error}</div>}
    </div>
  )
}


