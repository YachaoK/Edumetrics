import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export function exportText(content, filename = 'report.txt') {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function stringifyReportSections(result, fileName = '') {
  const joinLines = (v) => Array.isArray(v) ? v.join('\n- ') : String(v || '')
  return [
    `文件：${fileName}`,
    '班级整体表现:\n- ' + joinLines(result?.classOverview),
    '知识点掌握情况:\n- ' + joinLines(result?.knowledgeMastery),
    '重点关注的学生:\n- ' + joinLines(result?.focusStudents),
  ].join('\n\n')
}

/**
 * 导出PDF报告 - 使用html2canvas将内容区域转换为PDF
 * @param {Object} result - 分析结果对象（用于向后兼容，实际不使用）
 * @param {string} fileName - 文件名
 */
export async function exportToPDF(result, fileName = '未命名文件') {
  try {
    // 找到内容容器
    const appContainer = document.querySelector('.app')
    if (!appContainer) {
      throw new Error('找不到内容容器')
    }

    // 找到包含报告内容的div（排除按钮等）
    const contentDiv = Array.from(appContainer.children).find(child => 
      child.style.display === 'grid' || child.getAttribute('style')?.includes('grid')
    )

    if (!contentDiv) {
      throw new Error('找不到报告内容区域')
    }

    // 创建一个临时容器，包含标题和内容，用于导出
    const exportContainer = document.createElement('div')
    exportContainer.style.position = 'absolute'
    exportContainer.style.left = '-9999px'
    exportContainer.style.top = '0'
    exportContainer.style.width = '210mm' // A4宽度
    exportContainer.style.padding = '20mm'
    exportContainer.style.backgroundColor = '#ffffff'
    exportContainer.style.fontFamily = 'system-ui, Avenir, Helvetica, Arial, sans-serif'
    
    // 添加标题
    const titleElement = document.createElement('h1')
    titleElement.textContent = '学情分析报告'
    titleElement.style.fontSize = '24px'
    titleElement.style.marginBottom = '16px'
    titleElement.style.textAlign = 'center'
    titleElement.style.fontWeight = 'bold'
    exportContainer.appendChild(titleElement)
    
    // 添加文件信息
    const fileInfoElement = document.createElement('div')
    fileInfoElement.textContent = `文件：${fileName}`
    fileInfoElement.style.marginBottom = '20px'
    fileInfoElement.style.color = '#666'
    fileInfoElement.style.fontSize = '14px'
    exportContainer.appendChild(fileInfoElement)
    
    // 复制内容区域
    const clonedContent = contentDiv.cloneNode(true)
    
    // 为学生卡片增加间距，降低在卡片中间分页的概率
    const clonedStudentCards = clonedContent.querySelectorAll('div[style*="background-color: rgb(255, 243, 205)"], div[style*="#fff3cd"]')
    clonedStudentCards.forEach(card => {
      const currentStyle = card.getAttribute('style') || ''
      if (!currentStyle.includes('margin-bottom: 24px') && !currentStyle.includes('marginBottom: 24px')) {
        card.setAttribute('style', currentStyle + '; margin-bottom: 24px;')
      }
    })
    
    exportContainer.appendChild(clonedContent)
    
    document.body.appendChild(exportContainer)
    
    // 使用html2canvas转换为图片
    const canvas = await html2canvas(exportContainer, {
      scale: 2, // 提高清晰度
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: exportContainer.scrollWidth,
      height: exportContainer.scrollHeight
    })
    
    // 清理临时容器
    document.body.removeChild(exportContainer)

    // 计算PDF尺寸
    const imgWidth = 210 // A4宽度（mm）
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const pdf = new jsPDF('p', 'mm', 'a4')
    
    // 分页处理
    const pageHeight = 297 // A4高度（mm）
    const pageMargin = 15 // 增加页面边距，确保内容不被截断
    const usablePageHeight = pageHeight - pageMargin * 2 // 可用页面高度
    let heightLeft = imgHeight
    let position = -pageMargin

    // 添加第一页
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= usablePageHeight

    // 如果内容超过一页，添加更多页
    while (heightLeft > 0) {
      position = position - usablePageHeight
      pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= usablePageHeight
    }

    // 保存PDF
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const safeFileName = fileName.replace(/[^\w\s-]/g, '').trim() || '报告'
    pdf.save(`EduMetrics_${safeFileName}_${timestamp}.pdf`)
  } catch (error) {
    console.error('导出PDF失败:', error)
    alert('导出PDF失败：' + (error.message || '未知错误'))
  }
}
