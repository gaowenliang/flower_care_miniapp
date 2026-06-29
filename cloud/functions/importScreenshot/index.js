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
 *
 * 养花助手截图 OCR 格式特征（从实际测试图集确认）：
 *   - 年份单独一行: "2026" / "2025"
 *   - 日期行: "5月24" / "12月03"
 *   - 相对时间行（装饰性，可忽略）: "2天前" / "3个月前" / "1年前"
 *   - 动作关键词在日期**前面**，持续生效直到遇到新动作
 *   - 动作可带备注: "浇水 (延迟1天)"
 *   - 紧凑格式: "浇水 (延迟1天)" 或 "3月15浇水"
 */
function parseRecords(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const records = []
  const now = new Date()
  let currentYear = now.getFullYear()

  // ---- 预扫描：全文扫描年份标记 ----
  let hasYearMarker = false
  let relativeYearHint = 0  // "X年前" 推断的偏移量
  let relativeMonthHint = 0  // "X个月前" 推断的月份偏移
  for (const line of lines) {
    // 独立年份行: "2026" / "2025年"
    const standalone = line.match(/^(20\d{2})\s*年?$/)
    if (standalone) { hasYearMarker = true; break }
    // 行内年份: "2025年5月" / "2025-03" / "2025/5"
    const inline = line.match(/^(20\d{2})[年\-\/]/)
    if (inline) { currentYear = parseInt(inline[1]); hasYearMarker = true; break }
    // 相对时间线索（不 break，继续扫描全文）
    const relYear = line.match(/^(\d+)\s*年前$/)
    if (relYear) { relativeYearHint = Math.max(relativeYearHint, parseInt(relYear[1])) }
    const relMonth = line.match(/^(\d+)\s*个月前$/)
    if (relMonth) { relativeMonthHint = Math.max(relativeMonthHint, parseInt(relMonth[1])) }
  }

  // 没有明确年份标记，用相对时间线索推断
  if (!hasYearMarker) {
    if (relativeYearHint > 0) {
      currentYear = now.getFullYear() - relativeYearHint
    } else if (relativeMonthHint > 0) {
      // 从当前月份往前推 relativeMonthHint 个月
      const pastDate = new Date(now.getFullYear(), now.getMonth() - relativeMonthHint, 1)
      currentYear = pastDate.getFullYear()
    }
  }

  // ---- 定位数据起始行 ----
  let dataStart = 0
  for (let i = 0; i < lines.length; i++) {
    if (/^(20\d{2})\s*年?$/.test(lines[i])) { dataStart = i; break }
    if (/^(\d{1,2})月(\d{1,2})日?$/.test(lines[i])) { dataStart = i; break }
  }

  // ---- 第一遍：提取结构化事件 ----
  // 只做分类：year / action / date，不做去重
  const events = []
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i]

    // 跳过相对时间行
    if (/^\d+\s*(天|周|个月|年)前$/.test(line)) continue

    // 年份
    const yearMatch = line.match(/^(20\d{2})\s*年?$/)
    if (yearMatch) {
      events.push({ type: 'year', value: parseInt(yearMatch[1]) })
      continue
    }
    const ymMatch = line.match(/^(20\d{2})\s*年(\d{1,2})月/)
    if (ymMatch) {
      events.push({ type: 'year', value: parseInt(ymMatch[1]) })
      continue
    }

    // 动作关键词（可带备注）
    const actionMatch = line.match(/^(浇水|施肥|修剪|换盆|除虫|喷药|松土|扦插|播种)(?:\s*[(（](.+)[)）])?$/)
    if (actionMatch) {
      events.push({ type: 'action', value: actionMatch[1], note: actionMatch[2] || '' })
      continue
    }
    // 动作+备注变体: "浇水(延迟1天)"
    for (const kw of ACTION_KEYWORDS) {
      if (line.startsWith(kw + '(') || line.startsWith(kw + '（') || line.startsWith(kw + ' (')) {
        const noteMatch = line.match(/[(（](.+)[)）]/)
        events.push({ type: 'action', value: kw, note: noteMatch ? noteMatch[1] : '' })
        break
      }
    }

    // 日期
    const dateMatch = line.match(/^(\d{1,2})月(\d{1,2})日?$/)
    if (dateMatch) {
      const month = parseInt(dateMatch[1]); const day = parseInt(dateMatch[2])
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        events.push({ type: 'date', month, day })
      }
      continue
    }

    // 紧凑格式: "3月15浇水"
    const compactMatch = line.match(/^(\d{1,2})月(\d{1,2})日?\s*(浇水|施肥|修剪|换盆|除虫|喷药)/)
    if (compactMatch) {
      events.push({ type: 'action', value: compactMatch[3], note: '', lineIdx: i })
      events.push({ type: 'date', month: parseInt(compactMatch[1]), day: parseInt(compactMatch[2]), lineIdx: i })
      continue
    }
  }

  // ---- 第二遍：关联事件生成记录 ----
  // currentYear 已在预扫描阶段设置（明确年份 / "X年前"推断 / 默认当前年）
  if (events.length > 0 && events[0].type === 'year') {
    currentYear = events[0].value
  }
  // 不再无条件重置为当前年份
  let currentAction = null
  let pendingActions = []

  for (const evt of events) {
    if (evt.type === 'year') {
      currentYear = evt.value
      pendingActions = []
    } else if (evt.type === 'action') {
      pendingActions.push({ value: evt.value, note: evt.note })
      currentAction = evt.value
    } else if (evt.type === 'date') {
      const date = `${currentYear}-${String(evt.month).padStart(2, '0')}-${String(evt.day).padStart(2, '0')}`

      if (pendingActions.length > 0) {
        // 为每个待分配动作生成记录
        for (const pa of pendingActions) {
          records.push({
            plantName: '', action: pa.value, actionType: ACTION_MAP[pa.value],
            date, note: pa.note || ''
          })
        }
        pendingActions = []
      } else if (currentAction) {
        // 没有待分配动作，用上次动作
        records.push({
          plantName: '', action: currentAction, actionType: ACTION_MAP[currentAction],
          date, note: ''
        })
      } else {
        // 没有任何动作信息，默认浇水
        records.push({
          plantName: '', action: '浇水', actionType: 'water',
          date, note: '自动识别'
        })
      }
    }
  }

  // 启发式跨年推断：如果 events 里没有 year 类型事件
  const hasYearEvents = events.some(e => e.type === 'year')
  if (!hasYearEvents && records.length > 1) {
    // 截图 OCR 文本是倒序的（最新在上），所以月份从小跳到大（如2月→12月）说明跨年
    let year = currentYear
    for (let i = 1; i < records.length; i++) {
      const prevMonth = parseInt(records[i - 1].date.split('-')[1])
      const curMonth = parseInt(records[i].date.split('-')[1])
      // 月份从小跳到大（<=6月→>=7月），说明进入了上一年
      if (prevMonth <= 6 && curMonth >= 7) {
        year--
      }
      const day = records[i].date.split('-')[2]
      records[i].date = `${year}-${String(curMonth).padStart(2, '0')}-${day}`
    }
  }

  if (records.length > 0) return records

  // ---- 回退策略: 只找日期行，无动作时默认浇水 ----
  // currentYear 保留预扫描结果（可能已被 "X年前" 推断修正）
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const yearLineMatch = line.match(/^(20\d{2})\s*年?$/)
    if (yearLineMatch) {
      currentYear = parseInt(yearLineMatch[1])
      continue
    }
    const monthDayMatch = line.match(/^(\d{1,2})月(\d{1,2})日?$/)
    if (monthDayMatch) {
      const month = parseInt(monthDayMatch[1])
      const day = parseInt(monthDayMatch[2])
      if (month < 1 || month > 12 || day < 1 || day > 31) continue
      const date = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      records.push({ plantName: '', action: '浇水', actionType: 'water', date, note: '' })
    }
  }

  if (records.length > 0) return records

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
    records: unique,
    debug_ocr_text: fullText ? fullText.slice(0, 200) : '',  // 只返回前200字防隐私泄露
    _version: '2026-05-29-v3'  // 版本标记，确认是最新代码
  }
}
