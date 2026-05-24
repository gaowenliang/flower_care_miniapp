// cloud/functions/importScreenshot/index.js
// 从其他APP截图中识别植物养护信息
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const BAIDU_API_KEY = process.env.BAIDU_API_KEY || ''
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY || ''

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

// 百度通用OCR（高精度版）
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

// 从OCR文本中解析植物养护记录
function parsePlantRecords(words) {
  const text = words.map(w => w.words).join('\n')
  console.log('[importScreenshot] OCR原文:\n', text)

  const records = []

  // 常见模式：
  // 1. "植物名  浇水 2024-01-15"
  // 2. "植物名 | 浇水 | 3天前"
  // 3. 行格式：植物名 \n 操作 \n 日期
  // 4. 日历格子里的：日期 + 植物名 + 操作

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // 关键词
  const actionKeywords = ['浇水', '施肥', '修剪', '换盆', '除虫', '喷药', '松土', '扦插', '播种']
  const actionMap = {
    '浇水': 'water', '施肥': 'fertilize', '修剪': 'prune',
    '换盆': 'repot', '除虫': 'pest', '喷药': 'spray', '松土': 'loosen', '扦插': 'cutting', '播种': 'sow'
  }

  // 尝试按行解析
  let currentPlant = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 尝试匹配日期
    const dateMatch = line.match(/(\d{4})[年/\-.](\d{1,2})[月/\-.](\d{1,2})[日号]?/) ||
                      line.match(/(\d{1,2})[月/\-.](\d{1,2})[日号]?/)

    // 尝试匹配操作
    let foundAction = null
    for (const kw of actionKeywords) {
      if (line.includes(kw)) { foundAction = kw; break }
    }

    // 判断是否是植物名（非操作关键词、非纯日期、非纯数字）
    const isDate = /^\d{4}[年/\-.]\d{1,2}[月/\-.]\d{1,2}/.test(line) || /^\d{1,2}[月/\-.]\d{1,2}/.test(line)
    const isAction = actionKeywords.some(kw => line === kw || line === kw + '记录')
    const isNumber = /^\d+$/.test(line)

    if (!isDate && !isAction && !isNumber && line.length >= 2 && line.length <= 10) {
      // 可能是植物名（中文2-10字，不含特殊符号）
      if (/^[\u4e00-\u9fa5]+$/.test(line) && !foundAction) {
        currentPlant = line
      }
    }

    if (foundAction || dateMatch) {
      // 构造记录
      let date = null
      if (dateMatch) {
        const y = dateMatch[1] ? parseInt(dateMatch[1]) : new Date().getFullYear()
        const m = parseInt(dateMatch[2] || dateMatch[1])
        const d = parseInt(dateMatch[3] || dateMatch[2])
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
          date = `${y > 100 ? y : 2000 + y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        }
      }

      if (currentPlant && foundAction) {
        records.push({
          plantName: currentPlant,
          action: foundAction,
          actionType: actionMap[foundAction] || 'water',
          date: date || '',
          raw: line
        })
      }
    }
  }

  // 如果按行解析没结果，尝试整体解析（日期+植物+操作 在同一行）
  if (records.length === 0) {
    const fullText = text.replace(/\n/g, ' ')
    // 匹配类似 "月季 浇水 2024-01-15" 的模式
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
        plantName: m[1],
        action: m[2],
        actionType: actionMap[m[2]] || 'water',
        date,
        raw: m[0]
      })
    }
  }

  return records
}

exports.main = async (event) => {
  const { images } = event // base64 数组
  if (!images || images.length === 0) {
    return { success: false, error: '请提供截图' }
  }
  if (!BAIDU_API_KEY) {
    return { success: false, error: '百度API未配置' }
  }

  const allRecords = []
  for (let i = 0; i < images.length; i++) {
    const img = images[i]
    // 限制单张图片大小
    if (img.length > 4 * 1024 * 1024) {
      console.warn(`[importScreenshot] 图片${i}超过4MB，跳过`)
      continue
    }

    const ocrResult = await ocrImage(img)
    if (!ocrResult || !ocrResult.words_result) {
      console.warn(`[importScreenshot] 图片${i} OCR失败`)
      continue
    }

    const records = parsePlantRecords(ocrResult.words_result)
    allRecords.push(...records)
  }

  // 去重
  const unique = []
  const seen = new Set()
  for (const r of allRecords) {
    const key = `${r.plantName}_${r.action}_${r.date}`
    if (!seen.has(key)) { seen.add(key); unique.push(r) }
  }

  return {
    success: true,
    total: unique.length,
    records: unique,
    debug_ocr_count: allRecords.length
  }
}
