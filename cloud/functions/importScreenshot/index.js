// cloud/functions/importScreenshot/index.js
// 从其他 APP 截图中识别植物养护信息 — 纯 OCR + 正则解析（不依赖 VLM）
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

// 动作关键词映射
const ACTION_MAP = {
  '浇水': 'water', '施肥': 'fertilize', '修剪': 'prune',
  '换盆': 'repot', '除虫': 'pest', '喷药': 'spray',
  '松土': 'loosen', '扦插': 'cutting', '播种': 'sow'
}
const ACTION_KEYWORDS = Object.keys(ACTION_MAP)

/**
 * 纯正则解析 OCR 文本为结构化养护记录
 * 
 * 适配截图格式（列表式）：
 *   月日          ← 如 "5月24" 或 "12月03"
 *   N天前         ← 如 "2天前" 或 "3个月前"（可选）
 *   浇水          ← 动作关键词，可能有前缀乱码如 "D浇水" "(延迟1天)"
 * 
 * 也适配日历网格格式：
 *   "植物名 2026年3月 浇水 3/12 3/20 ..."
 */
function parseRecords(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const records = []

  // ---- 策略1: 列表格式（大部分截图） ----
  // 格式: 月日行 → 可选"N天前"行 → 动作行(含"浇水"等关键词)
  // 需要跨年份：遇到 "2025" / "2026" 等独立年份行时切换年份
  let currentYear = new Date().getFullYear()

  // 先扫描年份标记
  const yearLines = new Set()
  for (let i = 0; i < lines.length; i++) {
    if (/^(20\d{2})$/.test(lines[i])) {
      yearLines.add(i)
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 年份标记行
    if (/^(20\d{2})$/.test(line)) {
      currentYear = parseInt(line)
      continue
    }

    // 检测月日行: "5月24" "12月03" "2月25" 等
    const monthDayMatch = line.match(/^(\d{1,2})月(\d{1,2})$/)
    if (monthDayMatch) {
      const month = parseInt(monthDayMatch[1])
      const day = parseInt(monthDayMatch[2])
      if (month < 1 || month > 12 || day < 1 || day > 31) continue

      // 向下找动作关键词（最多看3行）
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const nextLine = lines[j]
        // 如果遇到新的月日行，停止
        if (/^\d{1,2}月\d{1,2}$/.test(nextLine)) break
        if (/^(20\d{2})$/.test(nextLine)) break

        // 在行中找动作关键词
        for (const kw of ACTION_KEYWORDS) {
          if (nextLine.includes(kw)) {
            // 提取备注（如"延迟1天"）
            let note = ''
            const delayMatch = nextLine.match(/延迟(\d+天)/)
            if (delayMatch) note = '延迟' + delayMatch[1]

            const date = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            records.push({
              plantName: '', // 植物名由前端让用户选择
              action: kw,
              actionType: ACTION_MAP[kw],
              date,
              note
            })
            break // 一行只匹配一个动作
          }
        }
      }
    }
  }

  if (records.length > 0) return records

  // ---- 策略2: 紧凑格式 "月日 动作" 在同一行 ----
  // 如 "5月24浇水" "2月25浇水 (延迟1天)"
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
        plantName: '',
        action: kw,
        actionType: ACTION_MAP[kw],
        date: `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        note
      })
    }
  }

  if (records.length > 0) return records

  // ---- 策略3: 日历网格格式 ----
  // "植物名 2026年3月 浇水 3/12 3/20 ..."
  let plantName = ''
  for (const line of lines) {
    // 提取植物名（纯中文2-8字，不含动作关键词）
    if (/^[\u4e00-\u9fa5]{2,8}$/.test(line)) {
      const hasAction = ACTION_KEYWORDS.some(kw => line.includes(kw))
      if (!hasAction) plantName = line
    }

    // "2026年3月" 格式提取年月
    const yearMonthMatch = line.match(/(20\d{2})年(\d{1,2})月/)
    if (yearMonthMatch) {
      const y = parseInt(yearMonthMatch[1])
      const m = parseInt(yearMonthMatch[2])
      // 在这一行及后续找日期+动作
      const remaining = line + ' ' + lines.slice(lines.indexOf(line) + 1, lines.indexOf(line) + 20).join(' ')
      for (const kw of ACTION_KEYWORDS) {
        if (remaining.includes(kw)) {
          // 找这个动作后的所有日期
          const afterAction = remaining.split(kw).pop()
          const dateMatches = [...afterAction.matchAll(/(\d{1,2})\/(\d{1,2})/g)]
          for (const dm of dateMatches) {
            const d = parseInt(dm[2])
            if (d >= 1 && d <= 31) {
              records.push({
                plantName,
                action: kw,
                actionType: ACTION_MAP[kw],
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
  if (!fileIDs || fileIDs.length === 0) {
    return { success: false, error: '请提供截图' }
  }
  if (!BAIDU_API_KEY) {
    return { success: false, error: '百度 OCR 未配置，请在云函数环境变量中设置 BAIDU_API_KEY 和 BAIDU_SECRET_KEY' }
  }

  const allOcrText = []
  for (let i = 0; i < fileIDs.length; i++) {
    const fileID = fileIDs[i]
    try {
      const downloadRes = await cloud.downloadFile({ fileID })
      const base64 = downloadRes.fileContent.toString('base64')

      if (base64.length > 8 * 1024 * 1024) {
        console.warn(`[importScreenshot] 图片${i}超过限制，跳过`)
        continue
      }
      const ocrResult = await ocrImage(base64)
      if (!ocrResult || !ocrResult.words_result) {
        console.warn(`[importScreenshot] 图片${i} OCR 失败`)
        continue
      }
      const pageText = ocrResult.words_result.map(w => w.words).join('\n')
      allOcrText.push(pageText)
    } catch (e) {
      console.error(`[importScreenshot] 处理图片${i}失败:`, e.message)
    }
  }

  if (allOcrText.length === 0) {
    return { success: false, error: 'OCR 识别失败，请确认图片清晰' }
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
    records: unique,
    debug_ocr_text: allOcrText
  }
}
