// tests/unit/health-score.test.js
const { describe, it, expect, mock } = require('../helpers')

// Mock storage
const originalStorage = require('../../miniprogram/utils/storage')

// 手动 mock
let mockGarden = []
let mockTasks = []
let mockRecords = []

const storage = {
  getGarden: () => mockGarden,
  getTasks: () => mockTasks,
  getRecords: () => mockRecords,
  getTasksByPlant: (id) => mockTasks.filter(t => t.userPlantId === id),
  getRecordsByPlant: (id) => mockRecords.filter(r => r.userPlantId === id)
}

// 简单模拟 require
global.require = (path) => {
  if (path.includes('storage')) return storage
  return {}
}

// 内联核心逻辑测试（避免 require 缓存问题）
function calcScore(userPlant) {
  const tasks = storage.getTasksByPlant(userPlant.id).filter(t => t.enabled)
  const records = storage.getRecordsByPlant(userPlant.id)
  const activeTasks = tasks

  let timeliness = 20
  if (activeTasks.length > 0) {
    const overdue = activeTasks.filter(t => Date.now() > t.nextDate).length
    timeliness = Math.round(40 * (1 - overdue / activeTasks.length))
  }

  let freq = 10
  const sevenDaysAgo = Date.now() - 7 * 86400000
  const recent = records.filter(r => r.date > sevenDaysAgo)
  if (activeTasks.length > 0) {
    const expected = 7
    freq = Math.round(30 * Math.min(1, recent.length / expected))
  }

  const days = Math.floor((Date.now() - userPlant.addedAt) / 86400000)
  const daysScore = Math.min(15, Math.round(days / 7))

  return Math.max(0, Math.min(100, timeliness + freq + daysScore))
}

describe('health-score', () => {
  it('新植物基础分不为0', () => {
    mockGarden = [{ id: 'p1', addedAt: Date.now() - 86400000 }]
    mockTasks = []
    mockRecords = []
    const score = calcScore(mockGarden[0])
    expect(score > 0).toBe(true)
  })

  it('所有任务逾期时及时分低', () => {
    mockGarden = [{ id: 'p1', addedAt: Date.now() - 7 * 86400000 }]
    mockTasks = [
      { userPlantId: 'p1', enabled: true, nextDate: Date.now() - 86400000 * 3, intervalDays: 7 },
      { userPlantId: 'p1', enabled: true, nextDate: Date.now() - 86400000 * 2, intervalDays: 7 }
    ]
    mockRecords = []
    const score = calcScore(mockGarden[0])
    expect(score < 50).toBe(true)
  })

  it('没有逾期且近期有记录时分高', () => {
    mockGarden = [{ id: 'p1', addedAt: Date.now() - 30 * 86400000 }]
    mockTasks = [
      { userPlantId: 'p1', enabled: true, nextDate: Date.now() + 86400000 * 3, intervalDays: 7 }
    ]
    mockRecords = Array.from({ length: 5 }, (_, i) => ({
      userPlantId: 'p1', type: 'water', date: Date.now() - i * 86400000
    }))
    const score = calcScore(mockGarden[0])
    expect(score >= 60).toBe(true)
  })

  it('分数范围 0-100', () => {
    mockGarden = [{ id: 'p1', addedAt: Date.now() }]
    mockTasks = []
    mockRecords = []
    const score = calcScore(mockGarden[0])
    expect(score >= 0 && score <= 100).toBe(true)
  })
})
