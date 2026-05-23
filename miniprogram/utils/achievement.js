// utils/achievement.js — 成就系统 v2（5大系列 + 隐藏成就）

const storage = require('./storage')
const family = require('./family')

/**
 * 成就设计思路：
 * 
 * 5大系列，每系 4-5 级，共 26 个成就
 * ┌─────────────────────────────────────────────┐
 * │ 🌱 入门系列    — 刚开始养花的基础里程碑        │
 * │ 🌳 收藏系列    — 植物数量/品类收集             │
 * │ 💪 养护系列    — 养护记录/完成次数             │
 * │ 🔥 坚持系列    — 连续打卡天数                  │
 * │ 🌟 隐藏系列    — 特殊条件触发的稀有成就        │
 * └─────────────────────────────────────────────┘
 * 
 * 每级解锁奖励：成就感 + 解锁时弹窗动画
 * 全部解锁后显示总进度百分比
 */

const ACHIEVEMENTS = [
  // ============ 🌱 入门系列 ============
  {
    id: 'first_plant',
    name: '初心者',
    emoji: '🌱',
    desc: '添加第一棵植物',
    series: 'starter',
    level: 1,
    condition: (stats) => stats.totalPlants >= 1
  },
  {
    id: 'first_water',
    name: '第一次浇水',
    emoji: '💧',
    desc: '完成第一次养护任务',
    series: 'starter',
    level: 2,
    condition: (stats) => stats.totalRecords >= 1
  },
  {
    id: 'first_photo',
    name: '留影纪念',
    emoji: '📷',
    desc: '在成长日记中拍第一张照片',
    series: 'starter',
    level: 3,
    condition: (stats) => stats.photoCount >= 1
  },
  {
    id: 'first_journal',
    name: '笔耕不辍',
    emoji: '📝',
    desc: '写第一条养护备注',
    series: 'starter',
    level: 4,
    condition: (stats) => stats.noteCount >= 1
  },

  // ============ 🌳 收藏系列 ============
  {
    id: 'plant_3',
    name: '小花园',
    emoji: '🌿',
    desc: '拥有3棵植物',
    series: 'collector',
    level: 1,
    condition: (stats) => stats.totalPlants >= 3
  },
  {
    id: 'plant_5',
    name: '花园新手',
    emoji: '🌸',
    desc: '拥有5棵植物',
    series: 'collector',
    level: 2,
    condition: (stats) => stats.totalPlants >= 5
  },
  {
    id: 'plant_10',
    name: '花园达人',
    emoji: '🌳',
    desc: '拥有10棵植物',
    series: 'collector',
    level: 3,
    condition: (stats) => stats.totalPlants >= 10
  },
  {
    id: 'plant_20',
    name: '植物收藏家',
    emoji: '🏡',
    desc: '拥有20棵植物',
    series: 'collector',
    level: 4,
    condition: (stats) => stats.totalPlants >= 20
  },

  // ============ 🌈 品类系列（收藏分支） ============
  {
    id: 'cat_2',
    name: '双管齐下',
    emoji: '✌️',
    desc: '同时养2个不同品类',
    series: 'collector',
    level: 5,
    condition: (stats) => stats.categoryCount >= 2
  },
  {
    id: 'cat_3',
    name: '三生万物',
    emoji: '🤟',
    desc: '同时养3个不同品类',
    series: 'collector',
    level: 6,
    condition: (stats) => stats.categoryCount >= 3
  },
  {
    id: 'cat_5',
    name: '五谷丰登',
    emoji: '🌈',
    desc: '集齐全部5个品类（绿植/花卉/多肉/香草/蔬果）',
    series: 'collector',
    level: 7,
    condition: (stats) => stats.categoryCount >= 5
  },

  // ============ 💪 养护系列 ============
  {
    id: 'record_10',
    name: '记录员',
    emoji: '📋',
    desc: '累计10条养护记录',
    series: 'care',
    level: 1,
    condition: (stats) => stats.totalRecords >= 10
  },
  {
    id: 'record_30',
    name: '勤勉园丁',
    emoji: '💪',
    desc: '累计30条养护记录',
    series: 'care',
    level: 2,
    condition: (stats) => stats.totalRecords >= 30
  },
  {
    id: 'record_50',
    name: '植物守护者',
    emoji: '🛡️',
    desc: '累计50条养护记录',
    series: 'care',
    level: 3,
    condition: (stats) => stats.totalRecords >= 50
  },
  {
    id: 'record_100',
    name: '养护大师',
    emoji: '🏆',
    desc: '累计100条养护记录',
    series: 'care',
    level: 4,
    condition: (stats) => stats.totalRecords >= 100
  },
  {
    id: 'record_200',
    name: '传奇园丁',
    emoji: '👨‍🌾',
    desc: '累计200条养护记录',
    series: 'care',
    level: 5,
    condition: (stats) => stats.totalRecords >= 200
  },

  // ============ 🔥 坚持系列 ============
  {
    id: 'streak_3',
    name: '三日之约',
    emoji: '🔰',
    desc: '连续3天完成养护',
    series: 'streak',
    level: 1,
    condition: (stats) => stats.careStreak >= 3
  },
  {
    id: 'streak_7',
    name: '坚持一周',
    emoji: '🔥',
    desc: '连续7天完成养护',
    series: 'streak',
    level: 2,
    condition: (stats) => stats.careStreak >= 7
  },
  {
    id: 'streak_14',
    name: '两周战士',
    emoji: '⚔️',
    desc: '连续14天完成养护',
    series: 'streak',
    level: 3,
    condition: (stats) => stats.careStreak >= 14
  },
  {
    id: 'streak_30',
    name: '月度之星',
    emoji: '⭐',
    desc: '连续30天完成养护',
    series: 'streak',
    level: 4,
    condition: (stats) => stats.careStreak >= 30
  },
  {
    id: 'streak_100',
    name: '百日传说',
    emoji: '👑',
    desc: '连续100天完成养护',
    series: 'streak',
    level: 5,
    condition: (stats) => stats.careStreak >= 100
  },

  // ============ 🌟 隐藏/特殊系列 ============
  {
    id: 'all_done',
    name: '今日事今日毕',
    emoji: '✅',
    desc: '一天内完成所有待办任务',
    series: 'special',
    level: 1,
    condition: (stats) => stats.allDoneToday
  },
  {
    id: 'batch_done',
    name: '效率大师',
    emoji: '⚡',
    desc: '一次完成5个以上任务',
    series: 'special',
    level: 2,
    condition: (stats) => stats.batchDone >= 5
  },
  {
    id: 'long_life',
    name: '长久陪伴',
    emoji: '💝',
    desc: '有一棵植物养了超过100天',
    series: 'special',
    level: 3,
    condition: (stats) => stats.maxPlantAge >= 100
  },
  {
    id: 'plant_whisperer',
    name: '植物语者',
    emoji: '🧙',
    desc: '拥有全部19种植物（解锁图鉴）',
    series: 'special',
    level: 4,
    condition: (stats) => stats.uniquePlants >= 19
  },
]

// 系列定义（用于分组展示）
const SERIES = {
  starter:   { name: '🌱 入门之旅', desc: '刚开始养花的基础里程碑' },
  collector: { name: '🌳 收藏图鉴', desc: '植物数量与品类收集' },
  care:      { name: '💪 养护之路', desc: '养护记录与完成次数' },
  streak:    { name: '🔥 坚持打卡', desc: '连续养护天数挑战' },
  special:   { name: '🌟 特殊成就', desc: '隐藏成就，特殊条件触发' }
}

/**
 * 计算连续养护天数
 */
function getCareStreak() {
  const isFamilyMode = family.isInFamily()
  const records = isFamilyMode ? family.getCachedRecords('') : storage.getRecords()
  if (records.length === 0) return 0

  const days = new Set()
  records.forEach(r => {
    const d = new Date(r.date)
    days.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)
  })

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
 * 收集扩展统计
 */
function getExtendedStats() {
  const isFamilyMode = family.isInFamily()
  let stats, garden, records

  if (isFamilyMode) {
    const plants = family.getCachedPlants()
    const tasks = family.getCachedTasks('')
    const allRecords = family.getCachedRecords('')
    stats = {
      totalPlants: plants.length,
      totalRecords: allRecords.length,
      categories: {},
    }
    plants.forEach(p => {
      if (p.category) stats.categories[p.category] = (stats.categories[p.category] || 0) + 1
    })
    garden = plants.map(p => ({ ...p, id: p._id }))
    records = allRecords
  } else {
    stats = storage.getStats()
    garden = storage.getGarden()
    records = storage.getRecords()
  }

  stats.careStreak = getCareStreak()
  stats.categoryCount = Object.keys(stats.categories || {}).length

  // 今日全部完成
  if (isFamilyMode) {
    const tasks = family.getCachedTasks('')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayTs = today.getTime()
    const dueTasks = tasks.filter(t => t.enabled && t.nextDate && t.nextDate <= todayTs + 86400000)
    stats.allDoneToday = dueTasks.length === 0 && stats.totalPlants > 0
  } else {
    const dueTasks = storage.getDueTasks()
    stats.allDoneToday = dueTasks.length === 0 && stats.totalPlants > 0
  }

  // 照片数
  stats.photoCount = records.filter(r => r.type === 'photo').length
  // 备注数
  stats.noteCount = records.filter(r => r.type === 'note').length

  // 最长寿植物天数
  if (garden.length > 0) {
    stats.maxPlantAge = Math.max(...garden.map(p => Math.floor((Date.now() - p.addedAt) / 86400000)))
  } else {
    stats.maxPlantAge = 0
  }

  // 不同植物种类数（去重 plantId）
  const uniqueIds = new Set(garden.map(p => p.plantId))
  stats.uniquePlants = uniqueIds.size

  // 批量完成（从 storage 读）
  try {
    stats.batchDone = wx.getStorageSync('batchDoneCount') || 0
  } catch (e) {
    stats.batchDone = 0
  }

  return stats
}

/**
 * 记录批量完成次数
 */
function recordBatchDone(count) {
  try {
    const prev = wx.getStorageSync('batchDoneCount') || 0
    wx.setStorageSync('batchDoneCount', Math.max(prev, count))
  } catch (e) {}
}

/**
 * 检查并解锁新成就
 * @returns {Array} 新解锁的成就列表
 */
function checkAchievements() {
  const stats = getExtendedStats()
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
 * 获取所有成就（含解锁状态，按系列分组）
 */
function getAll() {
  const unlocked = getUnlocked()
  return ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: unlocked.includes(a.id)
  }))
}

/**
 * 按系列分组返回
 */
function getGrouped() {
  const all = getAll()
  const groups = {}

  Object.keys(SERIES).forEach(key => {
    groups[key] = {
      ...SERIES[key],
      achievements: all.filter(a => a.series === key)
    }
  })

  return groups
}

/**
 * 获取总进度
 */
function getProgress() {
  const unlocked = getUnlocked()
  const total = ACHIEVEMENTS.length
  const done = unlocked.length
  return {
    done,
    total,
    percent: total > 0 ? Math.round(done / total * 100) : 0
  }
}

module.exports = {
  ACHIEVEMENTS,
  SERIES,
  checkAchievements,
  getAll,
  getGrouped,
  getProgress,
  getCareStreak,
  getExtendedStats,
  recordBatchDone
}
