// utils/health-score.js — 植物健康评分系统

const storage = require('./storage')

/**
 * 计算单棵植物的健康评分 (0-100)
 * 评分维度：
 * - 浇水及时率 (40分)
 * - 养护频率 (30分)
 * - 养护天数 (15分)
 * - 任务完成率 (15分)
 */
function calculateHealthScore(userPlant) {
  if (!userPlant) return 0

  const tasks = storage.getTasksByPlant(userPlant.id)
  const records = storage.getRecordsByPlant(userPlant.id)
  const activeTasks = tasks.filter(t => t.enabled)

  // 1. 浇水及时率 (40分)
  let timelinessScore = 20 // 基础分
  if (activeTasks.length > 0) {
    const overdue = activeTasks.filter(t => {
      const days = Math.floor((Date.now() - t.nextDate) / 86400000)
      return days > 0
    }).length
    const total = activeTasks.length
    const overdueRatio = overdue / total
    timelinessScore = Math.round(40 * (1 - overdueRatio))
  }
  timelinessScore = Math.max(0, Math.min(40, timelinessScore))

  // 2. 养护频率 (30分) — 最近7天有记录的比例
  let freqScore = 10
  const sevenDaysAgo = Date.now() - 7 * 86400000
  const recentRecords = records.filter(r => r.date > sevenDaysAgo)
  if (activeTasks.length > 0) {
    const expectedRecords = Math.min(7, Math.ceil(7 / Math.min(...activeTasks.map(t => t.intervalDays || 7))))
    freqScore = Math.round(30 * Math.min(1, recentRecords.length / Math.max(1, expectedRecords)))
  }
  freqScore = Math.max(0, Math.min(30, freqScore))

  // 3. 养护天数 (15分) — 越久越高分
  const daysCared = Math.floor((Date.now() - userPlant.addedAt) / 86400000)
  let daysScore = Math.min(15, Math.round(daysCared / 7)) // 每周1分，最多15分
  daysScore = Math.max(0, Math.min(15, daysScore))

  // 4. 任务完成率 (15分)
  let completionScore = 8
  if (records.length > 0 && activeTasks.length > 0) {
    const totalDone = records.filter(r => r.type !== 'photo' && r.type !== 'note').length
    const totalExpected = activeTasks.reduce((sum, t) => {
      return sum + Math.floor(daysCared / (t.intervalDays || 7))
    }, 0)
    if (totalExpected > 0) {
      completionScore = Math.round(15 * Math.min(1, totalDone / totalExpected))
    }
  }
  completionScore = Math.max(0, Math.min(15, completionScore))

  const total = timelinessScore + freqScore + daysScore + completionScore

  return {
    score: Math.max(0, Math.min(100, total)),
    breakdown: {
      timeliness: timelinessScore,
      frequency: freqScore,
      daysCared: daysScore,
      completion: completionScore
    }
  }
}

/**
 * 获取健康等级
 */
function getHealthLevel(score) {
  if (score >= 90) return { label: '非常健康', emoji: '🌿', color: '#2E7D32' }
  if (score >= 70) return { label: '健康', emoji: '🌱', color: '#4CAF50' }
  if (score >= 50) return { label: '一般', emoji: '🍃', color: '#8BC34A' }
  if (score >= 30) return { label: '需要关注', emoji: '🥀', color: '#9E9D24' }
  return { label: '亟需养护', emoji: '💀', color: '#5D4037' }
}

/**
 * 批量计算花园中所有植物的健康评分
 */
function calculateAllHealthScores() {
  const garden = storage.getGarden()
  return garden.map(plant => {
    const result = calculateHealthScore(plant)
    return {
      id: plant.id,
      nickname: plant.nickname,
      emoji: plant.emoji,
      ...result,
      level: getHealthLevel(result.score)
    }
  }).sort((a, b) => b.score - a.score)
}

module.exports = {
  calculateHealthScore,
  getHealthLevel,
  calculateAllHealthScores
}
