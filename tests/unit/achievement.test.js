// tests/unit/achievement.test.js
// Mock wx
global.wx = {
  getStorageSync: jest.fn((key) => {
    if (key === 'achievements') return []
    if (key === 'myGarden') return [{ id: 'p1', addedAt: Date.now() - 86400000 }]
    if (key === 'careTasks') return []
    if (key === 'careRecords') return []
    return null
  }),
  setStorageSync: jest.fn(),
  showToast: jest.fn()
}

const { ACHIEVEMENTS } = require('../../miniprogram/utils/achievement')

describe('achievement', () => {
  describe('ACHIEVEMENTS 定义', () => {
    test('至少有8个成就', () => {
      expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(8)
    })

    test('每个成就都有必要字段', () => {
      ACHIEVEMENTS.forEach(a => {
        expect(a.id).toBeTruthy()
        expect(a.name).toBeTruthy()
        expect(a.emoji).toBeTruthy()
        expect(a.desc).toBeTruthy()
        expect(typeof a.condition).toBe('function')
      })
    })

    test('成就ID不重复', () => {
      const ids = ACHIEVEMENTS.map(a => a.id)
      expect(new Set(ids).size).toBe(ids.length)
    })
  })

  describe('成就条件', () => {
    test('first_plant: 1棵植物即可解锁', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'first_plant')
      expect(a.condition({ totalPlants: 1 })).toBe(true)
      expect(a.condition({ totalPlants: 0 })).toBe(false)
    })

    test('plant_5: 5棵植物', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'plant_5')
      expect(a.condition({ totalPlants: 5 })).toBe(true)
      expect(a.condition({ totalPlants: 4 })).toBe(false)
    })

    test('record_10: 10条记录', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'record_10')
      expect(a.condition({ totalRecords: 10 })).toBe(true)
      expect(a.condition({ totalRecords: 9 })).toBe(false)
    })

    test('streak_7: 连续7天', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'streak_7')
      expect(a.condition({ careStreak: 7 })).toBe(true)
      expect(a.condition({ careStreak: 6 })).toBe(false)
    })
  })
})
