// cloud/functions/importScreenshot/index.js
// 从其他APP截图中识别植物养护信息 — OCR + AI 解析
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const BAIDU_API_KEY = process.env.BAIDU_API_KEY || ''
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || ''
const ZAI_API_KEY = process.env.ZAI_API_KEY || ''

let _tokenCache = { token: null, expiresAt: 0 }

async function getBaiduToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) return _tokenCache.token
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`
  return new Promise((resolve) => {
    const https = require('https')
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.access_token) {
            _tokenCache = { token: json.access_token, expiresAt: Date.now() + 29 * 86400000 }
            resolve(json.access_token)
          } else resolve(null)
        } catch (e) { resolve(null) }
      })
    }).on('error', () => resolve(null))
  })
}

// 百度通用 OCR（高精度版）
async function ocrImage(base64) {
  const token = await getBaiduToken()
  if (!token) return null
  const querystring = require('querystring')
  const postData = querystring.stringify({ image: base64, detect_language: 'true' })
  return new Promise((resolve) => {
    const https = require('https')
    const options = {
      hostname: 'aip.baidubce.com',
      path: `/rest/2.0/ocr/v1/accurate_basic?access_token=${token}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { resolve(null) } })
    })
    req.on('error', () => resolve(null))
    req.write(postData)
    req.end()
  })
}

// AI 解析 OCR 文本为结构化养护记录
async function aiParseRecords(ocrText) {
  if (!ZAI_API_KEY) {
    console.warn('[importScreenshot] ZAI_API_KEY 未配置，使用正则兜底')
    return regexParseRecords(ocrText)
  }

  const prompt = `你是一个植物养护记录解析器。用户上传了一张其他植物养护App的截图，OCR识别出了以下文本。

请从中提取所有植物养护记录，返回JSON数组格式。每条记录包含：
- plantName: 植物名称（string）
- action: 养护动作（浇水/施肥/修剪/换盆/除虫/喷药/松土/扦插/播种，string）
- actionType: 动作类型代码（water/fertilize/prune/repot/pest/spray/loosen/cutting/sow，string）
- date: 日期，格式 YYYY-MM-DD（string，如果只有月日则年份用2026）

OCR文本：
---
${ocrText}
---

只返回JSON数组，不要其他文字。如果没有识别到养护记录，返回空数组 []。`

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 2000
    })

    const options = {
      hostname: 'open.bigmodel.cn',
      path: '/api/paas/v4/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const content = json.choices[0].message.content.trim()
          // 提取JSON数组
          const jsonMatch = content.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            resolve(JSON.parse(jsonMatch[0]))
          } else {
            console.warn('[importScreenshot] AI返回格式异常:', content)
            resolve(regexParseRecords(ocrText))
          }
        } catch (e) {
          console.error('[importScreenshot] AI解析失败:', e)
          resolve(regexParseRecords(ocrText))
        }
      })
    })
    req.on('error', (e) => {
      console.error('[importScreenshot] AI请求失败:', e)
      resolve(regexParseRecords(ocrText))
    })
    req.write(postData)
    req.end()
  })
}

// 正则兜底解析
function regexParseRecords(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const records = []

  const actionKeywords = ['浇水', '施肥', '修剪', '换盆', '除虫', '喷药', '松土', '扦插', '播种']
  const actionMap = {
    '浇水': 'water', '施肥': 'fertilize', '修剪': 'prune',
    '换盆': 'repot', '除虫': 'pest', '喷药': 'spray', '松土': 'loosen', '扦插': 'cutting', '播种': 'sow'
  }

  let currentPlant = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const dateMatch = line.match(/(\d{4})[年/\-.](\d{1,2})[月/\-.](\d{1,2})[日号]?/) ||
                      line.match(/(\d{1,2})[月/\-.](\d{1,2})[日号]?/)
    let foundAction = null
    for (const kw of actionKeywords) {
      if (line.includes(kw)) { foundAction = kw; break }
    }

    const isDate = /^\d{4}[年/\-.]\d{1,2}[月/\-.]\d{1,2}/.test(line) || /^\d{1,2}[月/\-.]\d{1,2}/.test(line)
    const isAction = actionKeywords.some(kw => line === kw)
    const isNumber = /^\d+$/.test(line)

    if (!isDate && !isAction && !isNumber && line.length >= 2 && line.length <= 10) {
      if (/^[\u4e00-\u9fa5]+$/.test(line) && !foundAction) {
        currentPlant = line
      }
    }

    if (foundAction || dateMatch) {
      let date = null
      if (dateMatch) {
        const y = dateMatch[1] && dateMatch[1].length === 4 ? parseInt(dateMatch[1]) : new Date().getFullYear()
        const m = parseInt(dateMatch[2] || dateMatch[1])
        const d = parseInt(dateMatch[3] || dateMatch[2])
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        }
      }
      if (currentPlant && foundAction) {
        records.push({
          plantName: currentPlant, action: foundAction,
          actionType: actionMap[foundAction] || 'water', date: date || '', raw: line
        })
      }
    }
  }

  // 如果按行没结果，尝试整体解析
  if (records.length === 0) {
    const fullText = text.replace(/\n/g, ' ')
    const pattern = /([\u4e00-\u9fa5]{2,8})\s*(浇水|施肥|修剪|换盆|除虫|喷药)\s*(\d{4}[年/\-.]\d{1,2}[月/\-.]\d{1,2}|\d{1,2}[月/\-.]\d{1,2})/g
    let m
    while ((m = pattern.exec(fullText)) !== null) {
      const dateStr = m[3]
      const dp = dateStr.match(/(\d{4})[年/\-.](\d{1,2})[月/\-.](\d{1,2})/) || dateStr.match(/(\d{1,2})[月/\-.](\d{1,2})/)
      let date = ''
      if (dp) {
        const y = dp[1] && dp[1].length === 4 ? dp[1] : new Date().getFullYear()
        const mm = dp[1] && dp[1].length !== 4 ? dp[1] : dp[2]
        const dd = dp[3] || dp[2]
        date = `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
      }
      records.push({
        plantName: m[1], action: m[2],
        actionType: actionMap[m[2]] || 'water', date, raw: m[0]
      })
    }
  }

  return records
}

exports.main = async (event) => {
  const { images } = event
  if (!images || images.length === 0) {
    return { success: false, error: '请提供截图' }
  }
  if (!BAIDU_API_KEY) {
    return { success: false, error: '百度OCR未配置，请在云函数环境变量中设置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY' }
  }

  const allOcrText = []
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    if (img.length > 4 * 1024 * 1024) {
      console.warn(`[importScreenshot] 图片${i}超过4MB，跳过`)
      continue
    }
    const ocrResult = await ocrImage(img)
    if (!ocrResult || !ocrResult.words_result) {
      console.warn(`[importScreenshot] 图片${i} OCR失败`, ocrResult)
      continue
    }
    const pageText = ocrResult.words_result.map(w => w.words).join('\n')
    allOcrText.push(pageText)
    console.log(`[importScreenshot] 图片${i} OCR结果:\n`, pageText)
  }

  if (allOcrText.length === 0) {
    return { success: false, error: 'OCR识别失败，请确认图片清晰' }
  }

  // AI 解析（优先）+ 正则兜底
  const fullText = allOcrText.join('\n---\n')
  let records = await aiParseRecords(fullText)

  // 去重
  const unique = []
  const seen = new Set()
  for (const r of records) {
    const key = `${r.plantName}_${r.action}_${r.date}`
    if (!seen.has(key) && r.plantName && r.action) { seen.add(key); unique.push(r) }
  }

  return {
    success: true,
    total: unique.length,
    records: unique,
    debug_ocr_text: allOcrText
  }
}
