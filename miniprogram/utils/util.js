// utils/util.js - 工具函数

/**
 * 格式化日期
 */
function formatDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 格式化时间为友好文案
 */
function timeAgo(date) {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

/**
 * 计算下次养护日期
 */
function nextCareDate(lastDone, intervalDays) {
  const next = new Date(lastDone)
  next.setDate(next.getDate() + intervalDays)
  return next.getTime()
}

/**
 * 判断是否今天需要养护
 */
function isDueToday(nextDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(nextDate)
  next.setHours(0, 0, 0, 0)
  return next.getTime() <= today.getTime()
}

/**
 * 计算距下次养护天数
 */
function daysUntilNext(nextDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(nextDate)
  next.setHours(0, 0, 0, 0)
  const diff = Math.ceil((next - today) / (1000 * 60 * 60 * 24))
  return diff
}

/**
 * 生成唯一ID（递增计数器 + 时间戳 + 随机数）
 */
let _idCounter = 0
function genId() {
  _idCounter = (_idCounter + 1) % 1000000
  return 'p_' + Date.now() + '_' + _idCounter + '_' + Math.random().toString(36).substr(2, 4)
}

/**
 * 获取天气图标
 */
function getWeatherIcon(weather) {
  const map = {
    '晴': '☀️', '多云': '⛅', '阴': '☁️', '小雨': '🌧️',
    '大雨': '⛈️', '雪': '🌨️', '雾': '🌫️'
  }
  return map[weather] || '🌤️'
}

/**
 * 获取难度颜色
 */
function getDifficultyColor(diff) {
  const map = { '超简单': '#4CAF50', '简单': '#66BB6A', '中等': '#8BC34A', '较难': '#33691E' }
  return map[diff] || '#999'
}

/**
 * 将记录按日期分组为时间线
 * 用于 plant-detail 和 calendar 页面共享
 */
function buildRecordTimeline(records, typeEmojis, typeColors) {
  const defaultEmojis = {
    water: '💧', fertilize: '🧪', prune: '✂️', repot: '🏺', spray: '💉',
    photo: '📷', note: '📝', retro: '🔖', custom: '🌿',
    pest: '🐛', loosen: '🌱', cutting: '✂️', sow: '🌱', postpone: '⏩'
  }
  const defaultColors = {
    water:    { bg: '#E3F2FD', border: '#BBDEFB', text: '#1565C0' },
    fertilize:{ bg: '#FFF3E0', border: '#FFE0B2', text: '#E65100' },
    prune:    { bg: '#FCE4EC', border: '#F8BBD0', text: '#AD1457' },
    repot:    { bg: '#EFEBE9', border: '#D7CCC8', text: '#4E342E' },
    spray:    { bg: '#E8EAF6', border: '#C5CAE9', text: '#283593' },
    photo:    { bg: '#F3E5F5', border: '#E1BEE7', text: '#6A1B9A' },
    note:     { bg: '#FFF8E1', border: '#FFECB3', text: '#F57F17' },
    pest:     { bg: '#FFEBEE', border: '#FFCDD2', text: '#B71C1C' },
    retro:    { bg: '#FBE9E7', border: '#FFCCBC', text: '#BF360C' },
    custom:   { bg: '#E0F2F1', border: '#B2DFDB', text: '#00695C' },
    postpone: { bg: '#ECEFF1', border: '#CFD8DC', text: '#546E7A' }
  }
  const emojis = { ...defaultEmojis, ...(typeEmojis || {}) }
  const colors = { ...defaultColors, ...(typeColors || {}) }

  const dayMap = new Map()
  records.forEach((r, idx) => {
    const d = new Date(r.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!dayMap.has(key)) dayMap.set(key, [])
    const t = r.type || r.taskType || r.actionType || 'water'
    const emoji = emojis[t] || '💧'
    const color = colors[t] || colors.custom
    dayMap.get(key).push({ ...r, emoji, idx, color })
  })

  const sortedDays = [...dayMap.entries()].sort((a, b) => b[0].localeCompare(a[0]))

  const timeline = []
  let lastMonth = ''
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  for (const [dateStr, dayRecords] of sortedDays) {
    const [y, m] = dateStr.split('-')
    const monthLabel = `${y}年${parseInt(m)}月`
    if (monthLabel !== lastMonth) {
      timeline.push({ type: 'month', label: monthLabel })
      lastMonth = monthLabel
    }
    const isToday = dateStr === todayKey
    const d = new Date(dateStr)
    const weekDay = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
    timeline.push({
      type: 'day',
      dateStr,
      dayLabel: isToday ? '今天' : `${parseInt(dateStr.split('-')[1])}/${parseInt(dateStr.split('-')[2])} 周${weekDay}`,
      isToday,
      records: dayRecords
    })
  }

  return timeline
}

module.exports = {
  formatDate,
  timeAgo,
  nextCareDate,
  isDueToday,
  daysUntilNext,
  genId,
  getWeatherIcon,
  getDifficultyColor,
  buildRecordTimeline
}
