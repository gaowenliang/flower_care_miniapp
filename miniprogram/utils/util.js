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
  const map = { '超简单': '#4CAF50', '简单': '#8BC34A', '中等': '#FF9800', '较难': '#F44336' }
  return map[diff] || '#999'
}

module.exports = {
  formatDate,
  timeAgo,
  nextCareDate,
  isDueToday,
  daysUntilNext,
  genId,
  getWeatherIcon,
  getDifficultyColor
}
