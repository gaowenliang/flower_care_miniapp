// utils/achievement.js — 成就系统

const storage = require('./storage')

// 成就定义
const ACHIEVEMENTS = [
  { id: 'first_plant', name: '初心者', emoji: '🌱', desc: '添加第一棵植物', condition: (stats) => stats.totalPlants >= 1 },
  { id: 'plant_5', name: '花园新手', emoji: '🌸', desc: '拥有5棵植物', condition: (stats) => stats.totalPlants >= 5 },
  { id: 'plant_10', name: '花园达人', emoji: '🌳', desc: '拥有10棵植物', condition: (stats) => stats.totalPlants >= 10 },
  { id: 'plant_20', name: '植物收藏家', emoji: '🏡', desc: '拥有20棵植物', condition: (stats) => stats.totalPlants >= 20 },
  { id: 'record_10', name: '记录员', emoji: '📝', desc: '累计10条养护记录', condition: (stats) => stats.totalRecords >= 10 },
  { id: 'record_50', name: '勤奋园丁', emoji: '💪', desc: '累计50条养护记录', condition: (stats) => stats.totalRecords >= 50 },
  { id: 'record_100', name: '养护大师', emoji: '🏆', desc: '累计100条养护记录', condition: (stats) => stats.totalRecords >= 100 },
  { id: 'streak_7', name: '坚持一周', emoji: '🔥', desc: '连续7天完成养护', condition: (stats) => stats.careStreak >= 7 },
  { id: 'streak_30', name: '月度之星', emoji: '⭐', desc: '连续30天完成养护', condition: (stats) => careStreak >= 30 },
  { id: 'streak_100', name: '百日坚持', emoji: '👑', desc: '连续100天完成养护', condition: (stats) => stats.careStreak >= 100 },
  { id: 'all_done', name: '今日事今日毕', emoji: '✅', desc: '一天内完成所有待办任务', condition: (stats) => stats.allDoneToday },
  { id: 'categories_5', name: '五谷丰登', emoji: '🌈', desc: '集齐5个植物品类', condition: (stats) => stats.categoryCount >= 5 },
]

/**
 * 计算连续养护天数
 */
function getCareStreak() {
  const records = storage.getRecords()
  if (records.length === 0) return 0

  // 按天分组
  const days = new Set()
  records.forEach(r => {
    const d = new Date(r.date)
    days.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)
  })

  // 从今天往前数连续天数
  let streak = 0
  const now = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(now.getTime() - i * 86400000)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    if (days.has(key)) {
      streak++
    } else {
      break
    }
  }
  return streak
}

/**
 * 检查并解锁新成就
 * @returns {Array} 新解锁的成就列表
 */
function checkAchievements() {
  const stats = storage.getStats()
  stats.careStreak = getCareStreak()

  // 品类数
  stats.categoryCount = Object.keys(stats.categories || {}).length

  // 今日全部完成
  const dueTasks = storage.getDueTasks()
  stats.allDoneToday = dueTasks.length === 0 && stats.totalPlants > 0

  const unlocked = getUnlocked()
  const newOnes = []

  ACHIEVEMENTS.forEach(a => {
    if (!unlocked.includes(a.id) && a.condition(stats)) {
      newOnes.push(a)
      unlocked.push(a.id)
    }
  })

  if (newOnes.length > 0) {
    saveUnlocked(unlocked)
  }

  return newOnes
}

function getUnlocked() {
  try {
    return wx.getStorageSync('achievements') || []
  } catch (e) {
    return []
  }
}

function saveUnlocked(list) {
  try {
    wx.setStorageSync('achievements', list)
  } catch (e) {}
}

/**
 * 获取所有成就（含解锁状态）
 */
function getAll() {
  const unlocked = getUnlocked()
  return ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: unlocked.includes(a.id)
  }))
}

module.exports = {
  ACHIEVEMENTS,
  checkAchievements,
  getAll,
  getCareStreak
}
