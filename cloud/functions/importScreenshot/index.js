// cloud/functions/importScreenshot/index.js
// 从其他 APP 截图中识别植物养护信息 — 纯 OCR + 正则解析（不依赖 VLM）
const cloud = require('wx-server-sdk')
const https = require('https')
const querystring = require('querystring')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// P2: 环境变量缺失直接报错，不用空串 fallback
const BAIDU_API_KEY = process.env.BAIDU_API_KEY
const BAIDU_SECRET_KEY = process.env.BAIDU_SECRET_KEY

// 模块级常量（P2: 避免每次调用重建）
const ACTION_MAP = {
  '浇水': 'water', '施肥': 'fertilize', '修剪': 'prune',
  '换盆': 'repot', '除虫': 'pest', '喷药': 'spray',
  '松土': 'loosen', '扦插': 'cutting', '播种': 'sow'
}
const ACTION_KEYWORDS = Object.keys(ACTION_MAP)

// P0: token 缓存
let _tokenCache = { token: null, expiresAt: 0 }

// P1: 带 reject 和超时的 Promise 包装
function httpGet(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy()
      reject(new Error('请求超时'))
    }, timeoutMs)
    const req = https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        clearTimeout(timer)
        try { resolve(JSON.parse(data)) } catch (e) { reject(new Error('JSON解析失败: ' + data.slice(0, 200))) }
      })
    })
    req.on('error', (e) => { clearTimeout(timer); reject(e) })
  })
}

function httpPost(hostname, path, body, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy()
      reject(new Error('请求超时'))
    }, timeoutMs)
    const options = {
      hostname,
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        clearTimeout(timer)
        try { resolve(JSON.parse(data)) } catch (e) { reject(new Error('JSON解析失败: ' + data.slice(0, 200))) }
      })
    })
    req.on('error', (e) => { clearTimeout(timer); reject(e) })
    req.write(body)
    req.end()
  })
}

async function getBaiduToken() {
  if (_tokenCache.token && Date.now() < _tokenCache.expiresAt) return _tokenCache.token

  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${BAIDU_API_KEY}&client_secret=${BAIDU_SECRET_KEY}`
  const json = await httpGet(url, 8000)

  if (!json.access_token) {
    throw new Error('百度 Token 获取失败: ' + (json.error_description || JSON.stringify(json).slice(0, 200)))
  }
  _tokenCache = { token: json.access_token, expiresAt: Date.now() + 29 * 86400000 }
  return json.access_token
}

async function ocrImage(base64) {
  const token = await getBaiduToken()
  const postData = querystring.stringify({ image: base64, detect_language: 'true' })
  const result = await httpPost(
    'aip.baidubce.com',
    `/rest/2.0/ocr/v1/accurate_basic?access_token=${token}`,
    postData,
    15000
  )

  if (result.error_code) {
    throw new Error('百度 OCR 错误: ' + result.error_msg)
  }
  if (!result.words_result || result.words_result.length === 0) {
    return null // 正常：图片确实没文字
  }
  return result.words_result.map(w => w.words).join('\n')
}

/**
 * 纯正则解析 OCR 文本为结构化养护记录
 */
function parseRecords(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const records = []
  const now = new Date()
  let currentYear = now.getFullYear()

  // 先扫描全文，找出所有年份标记（优先用最早出现的年份作为起始年份）
  const yearMarkers = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 匹配: "2025" / "2025年" / "2025 年" / "2025年3月" 等
    const yearMatch = line.match(/^(20\d{2})\s*年?/)
    if (yearMatch) {
      const y = parseInt(yearMatch[1])
      yearMarkers.push({ index: i, year: y })
    }
  }

  // ---- 策略1: 列表格式（大部分截图） ----
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 年份标记行（宽松匹配: "2025" / "2025年" / "2025 年" 等）
    const yearLineMatch = line.match(/^(20\d{2})\s*年?$/)
    if (yearLineMatch) {
      currentYear = parseInt(yearLineMatch[1])
      continue
    }
    // 带月份的年份行: "2025年3月"
    const yearMonthLineMatch = line.match(/^(20\d{2})\s*年(\d{1,2})月/)
    if (yearMonthLineMatch) {
      currentYear = parseInt(yearMonthLineMatch[1])
      continue
    }

    // 检测月日行: "5月24" "12月03"
    const monthDayMatch = line.match(/^(\d{1,2})月(\d{1,2})$/)
    if (monthDayMatch) {
      const month = parseInt(monthDayMatch[1])
      const day = parseInt(monthDayMatch[2])
      if (month < 1 || month > 12 || day < 1 || day > 31) continue

      // 向下找动作关键词（最多看3行）
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nextLine = lines[j]
        if (/^\d{1,2}月\d{1,2}$/.test(nextLine)) break
        if (/^(20\d{2})$/.test(nextLine)) break

        for (const kw of ACTION_KEYWORDS) {
          if (nextLine.includes(kw)) {
            let note = ''
            const delayMatch = nextLine.match(/延迟(\d+天)/)
            if (delayMatch) note = '延迟' + delayMatch[1]

            const date = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            records.push({ plantName: '', action: kw, actionType: ACTION_MAP[kw], date, note })
            break
          }
        }
      }
    }
  }

  // 策略1结束后，如果没有年份标记但有记录，用启发式修正年份
  if (records.length > 0) {
    // 如果全文没有年份标记，且最早记录的月份 > 当前月份，说明是去年的数据
    if (yearMarkers.length === 0) {
      const earliestMonth = Math.min(...records.map(r => parseInt(r.date.split('-')[1])))
      if (earliestMonth > now.getMonth() + 1) {
        currentYear = now.getFullYear() - 1
        for (const r of records) {
          const parts = r.date.split('-')
          r.date = `${currentYear}-${parts[1]}-${parts[2]}`
        }
      }
    }
    return records
  }

  // ---- 策略2: 紧凑格式 "月日动作" 在同一行 ----
  for (const line of lines) {
    const compactMatch = line.match(/(\d{1,2})月(\d{1,2})(浇水|施肥|修剪|换盆|除虫|喷药)/)
    if (compactMatch) {
      const month = parseInt(compactMatch[1])
      const day = parseInt(compactMatch[2])
      const kw = compactMatch[3]
      let note = ''
      const delayMatch = line.match(/延迟(\d+天)/)
      if (delayMatch) note = '延迟' + delayMatch[1]

      records.push({
        plantName: '', action: kw, actionType: ACTION_MAP[kw],
        date: `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        note
      })
    }
  }

  if (records.length > 0) {
    // 同样的启发式年份修正
    if (yearMarkers.length === 0) {
      const earliestMonth = Math.min(...records.map(r => parseInt(r.date.split('-')[1])))
      if (earliestMonth > now.getMonth() + 1) {
        currentYear = now.getFullYear() - 1
        for (const r of records) {
          const parts = r.date.split('-')
          r.date = `${currentYear}-${parts[1]}-${parts[2]}`
        }
      }
    }
    return records
  }

  // ---- 策略3: 日历网格格式 ----
  let plantName = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^[\u4e00-\u9fa5]{2,8}$/.test(line) && !ACTION_KEYWORDS.some(kw => line.includes(kw))) {
      plantName = line
    }

    const yearMonthMatch = line.match(/(20\d{2})年(\d{1,2})月/)
    if (yearMonthMatch) {
      const y = parseInt(yearMonthMatch[1])
      const m = parseInt(yearMonthMatch[2])
      const remaining = line + ' ' + lines.slice(i + 1, i + 20).join(' ')
      for (const kw of ACTION_KEYWORDS) {
        if (remaining.includes(kw)) {
          const afterAction = remaining.split(kw).pop()
          const dateMatches = [...afterAction.matchAll(/(\d{1,2})\/(\d{1,2})/g)]
          for (const dm of dateMatches) {
            const d = parseInt(dm[2])
            if (d >= 1 && d <= 31) {
              records.push({
                plantName, action: kw, actionType: ACTION_MAP[kw],
                date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                note: ''
              })
            }
          }
        }
      }
    }
  }

  return records
}

exports.main = async (event) => {
  const { fileIDs } = event

  // 输入校验
  if (!fileIDs || !Array.isArray(fileIDs) || fileIDs.length === 0) {
    return { success: false, error: '请提供截图' }
  }
  if (fileIDs.length > 9) {
    return { success: false, error: '最多支持 9 张截图' }
  }

  // P0: 环境变量检查（提前报错）
  if (!BAIDU_API_KEY || !BAIDU_SECRET_KEY) {
    return { success: false, error: '百度 OCR 未配置，请在云函数环境变量中设置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY' }
  }

  const allOcrText = []
  const errors = []

  for (let i = 0; i < fileIDs.length; i++) {
    const fileID = fileIDs[i]
    try {
      const downloadRes = await cloud.downloadFile({ fileID })
      const base64 = downloadRes.fileContent.toString('base64')

      if (base64.length > 8 * 1024 * 1024) {
        errors.push(`图片${i + 1}超过8MB限制`)
        continue
      }

      const pageText = await ocrImage(base64)
      if (!pageText) {
        errors.push(`图片${i + 1}未识别到文字`)
        continue
      }
      allOcrText.push(pageText)
    } catch (e) {
      console.error(`[importScreenshot] 处理图片${i}失败:`, e.message)
      errors.push(`图片${i + 1}: ${e.message}`)
    }
  }

  if (allOcrText.length === 0) {
    return {
      success: false,
      error: errors.length > 0 ? errors.join('；') : 'OCR 识别失败，请确认图片清晰'
    }
  }

  // 纯正则解析
  const fullText = allOcrText.join('\n')
  let records = parseRecords(fullText)

  // 去重
  const unique = []
  const seen = new Set()
  for (const r of records) {
    const key = `${r.action}_${r.date}`
    if (!seen.has(key) && r.action && r.date) { seen.add(key); unique.push(r) }
  }

  // 按日期排序（旧→新）
  unique.sort((a, b) => a.date.localeCompare(b.date))

  return {
    success: true,
    total: unique.length,
    records: unique
    // P2: 生产环境不返回 debug_ocr_text
  }
}
