// tests/unit/achievement.test.js
global.wx = {
  getStorageSync: jest.fn((key) => {
    if (key === 'achievements') return []
    if (key === 'myGarden') return [{ id: 'p1', plantId: 'monstera', addedAt: Date.now() - 86400000 }]
    if (key === 'careTasks') return []
    if (key === 'careRecords') return []
    if (key === 'batchDoneCount') return 0
    return null
  }),
  setStorageSync: jest.fn(),
  showToast: jest.fn()
}

const { ACHIEVEMENTS, SERIES, getProgress } = require('../../miniprogram/utils/achievement')

describe('achievement v2', () => {
  describe('ACHIEVEMENTS 定义', () => {
    test('至少有20个成就', () => {
      expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20)
    })

    test('每个成就都有必要字段', () => {
      ACHIEVEMENTS.forEach(a => {
        expect(a.id).toBeTruthy()
        expect(a.name).toBeTruthy()
        expect(a.emoji).toBeTruthy()
        expect(a.desc).toBeTruthy()
        expect(a.series).toBeTruthy()
        expect(typeof a.level).toBe('number')
        expect(typeof a.condition).toBe('function')
      })
    })

    test('成就ID不重复', () => {
      const ids = ACHIEVEMENTS.map(a => a.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    test('每个成就都属于有效系列', () => {
      const validSeries = Object.keys(SERIES)
      ACHIEVEMENTS.forEach(a => {
        expect(validSeries).toContain(a.series)
      })
    })
  })

  describe('5大系列', () => {
    test('有5个系列', () => {
      expect(Object.keys(SERIES).length).toBe(5)
    })

    test('每个系列都有成就', () => {
      Object.keys(SERIES).forEach(key => {
        const count = ACHIEVEMENTS.filter(a => a.series === key).length
        expect(count).toBeGreaterThan(0)
      })
    })

    test('入门系列有4个成就', () => {
      expect(ACHIEVEMENTS.filter(a => a.series === 'starter').length).toBe(4)
    })

    test('坚持系列有5个成就（3/7/14/30/100天）', () => {
      expect(ACHIEVEMENTS.filter(a => a.series === 'streak').length).toBe(5)
    })
  })

  describe('成就条件', () => {
    test('first_plant: 1棵植物', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'first_plant')
      expect(a.condition({ totalPlants: 1 })).toBe(true)
      expect(a.condition({ totalPlants: 0 })).toBe(false)
    })

    test('first_water: 1条记录', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'first_water')
      expect(a.condition({ totalRecords: 1 })).toBe(true)
    })

    test('first_photo: 1张照片', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'first_photo')
      expect(a.condition({ photoCount: 1 })).toBe(true)
    })

    test('plant_10: 10棵植物', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'plant_10')
      expect(a.condition({ totalPlants: 10 })).toBe(true)
      expect(a.condition({ totalPlants: 9 })).toBe(false)
    })

    test('cat_5: 5个品类', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'cat_5')
      expect(a.condition({ categoryCount: 5 })).toBe(true)
    })

    test('streak_7: 连续7天', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'streak_7')
      expect(a.condition({ careStreak: 7 })).toBe(true)
    })

    test('streak_14: 连续14天', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'streak_14')
      expect(a.condition({ careStreak: 14 })).toBe(true)
      expect(a.condition({ careStreak: 13 })).toBe(false)
    })

    test('long_life: 100天', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'long_life')
      expect(a.condition({ maxPlantAge: 100 })).toBe(true)
    })

    test('record_200: 200条记录', () => {
      const a = ACHIEVEMENTS.find(a => a.id === 'record_200')
      expect(a.condition({ totalRecords: 200 })).toBe(true)
    })
  })

  describe('getProgress', () => {
    test('返回进度对象', () => {
      const p = getProgress()
      expect(p.done).toBe(0)
      expect(p.total).toBe(ACHIEVEMENTS.length)
      expect(p.percent).toBe(0)
    })
  })
})
