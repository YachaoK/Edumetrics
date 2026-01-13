// Lightweight client-side paper text extraction with optional deps.
// If libs are not installed, we degrade gracefully and return a short hint.

export async function extractPaperPreview(file, { maxChars = 20000 } = {}) {
  const name = (file?.name || '').toLowerCase()
  if (name.endsWith('.pdf')) return extractPdf(file, maxChars)
  if (name.endsWith('.docx')) return extractDocx(file, maxChars)
  if (name.endsWith('.doc')) return Promise.resolve('无法直接解析 .doc，请转为 PDF 或 .docx')
  if (name.match(/\.(png|jpg|jpeg)$/)) return extractImage(file, maxChars)
  return '不支持的试卷格式，请上传 PDF、图片或 .docx'
}

async function extractPdf(file, maxChars) {
  try {
    // Use modern ESM entry first, then fallback
    let pdfjs
    try {
      pdfjs = await import('pdfjs-dist/build/pdf.min.mjs')
    } catch {
      try {
        pdfjs = await import('pdfjs-dist/build/pdf.mjs')
      } catch {
        pdfjs = await import('pdfjs-dist')
      }
    }

    // Attempt to set workerSrc via URL so worker mode can be enabled
    try {
      const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    } catch {}

    const array = new Uint8Array(await file.arrayBuffer())
    const doc = await pdfjs.getDocument({ data: array, disableWorker: !!(pdfjs.GlobalWorkerOptions && pdfjs.GlobalWorkerOptions.workerSrc ? false : true) }).promise
    let text = ''
    const pages = doc.numPages
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      text += content.items.map((it) => it.str).join(' ') + '\n'
      if (text.length > maxChars) break
    }
    return sanitize(text).slice(0, maxChars)
  } catch (e) {
    return `PDF解析失败：${e?.message || '未知错误'}`
  }
}

async function extractDocx(file, maxChars) {
  try {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return sanitize(result.value || '').slice(0, maxChars)
  } catch (e) {
    return '未安装 mammoth，无法解析 .docx（可执行 npm i mammoth）'
  }
}

async function extractImage(file, maxChars) {
  try {
    const Tesseract = await import('tesseract.js')
    const { data } = await Tesseract.recognize(file, 'chi_sim+eng', { logger: () => {} })
    return sanitize(data.text || '').slice(0, maxChars)
  } catch (e) {
    return '未安装 tesseract.js，无法对图片进行 OCR（可执行 npm i tesseract.js）'
  }
}

function sanitize(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
}


