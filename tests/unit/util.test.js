/**
 * 养花助手 - 单元测试
 * 
 * 测试范围：utils/util.js 中的工具函数
 * 运行方式：npm test
 */

// ============ 工具函数提取 ============
// 由于小程序环境无法直接跑 Jest，这里将核心逻辑提取为纯函数测试
// 实际项目中建议用 miniprogram-simulate 或将纯函数独立为 npm 模块

const {
  formatDate,
  timeAgo,
  nextCareDate,
  isDueToday,
  daysUntilNext,
  genId,
  getDifficultyColor
} = require('../../miniprogram/utils/util')

// ============ formatDate ============
describe('formatDate', () => {
  test('格式化正常日期', () => {
    expect(formatDate('2026-05-20T10:30:00')).toBe('2026-05-20')
  })

  test('格式化 Date 对象', () => {
    expect(formatDate(new Date(2026, 0, 15))).toBe('2026-01-15')
  })

  test('格式化时间戳', () => {
    const ts = new Date(2026, 11, 31).getTime()
    expect(formatDate(ts)).toBe('2026-12-31')
  })
})

// ============ timeAgo ============
describe('timeAgo', () => {
  const now = Date.now()

  test('今天', () => {
    expect(timeAgo(now)).toBe('今天')
  })

  test('昨天', () => {
    expect(timeAgo(now - 86400000)).toBe('昨天')
  })

  test('3天前', () => {
    expect(timeAgo(now - 86400000 * 3)).toBe('3天前')
  })

  test('2周前', () => {
    expect(timeAgo(now - 86400000 * 14)).toBe('2周前')
  })

  test('2个月前', () => {
    expect(timeAgo(now - 86400000 * 65)).toBe('2个月前')
  })

  test('1年前', () => {
    expect(timeAgo(now - 86400000 * 400)).toBe('1年前')
  })
})

// ============ nextCareDate ============
describe('nextCareDate', () => {
  test('从今天算7天后', () => {
    const now = Date.now()
    const next = nextCareDate(now, 7)
    const diff = (next - now) / (86400000)
    expect(diff).toBe(7)
  })

  test('间隔0天', () => {
    const now = Date.now()
    const next = nextCareDate(now, 0)
    expect(next).toBe(now)
  })

  test('间隔1天', () => {
    const now = Date.now()
    const next = nextCareDate(now, 1)
    const diff = Math.round((next - now) / 86400000)
    expect(diff).toBe(1)
  })

  test('间隔30天', () => {
    const now = Date.now()
    const next = nextCareDate(now, 30)
    const diff = Math.round((next - now) / 86400000)
    expect(diff).toBe(30)
  })
})

// ============ isDueToday ============
describe('isDueToday', () => {
  test('今天的日期应该到期', () => {
    expect(isDueToday(Date.now())).toBe(true)
  })

  test('过去的日期应该到期', () => {
    expect(isDueToday(Date.now() - 86400000 * 3)).toBe(true)
  })

  test('明天的日期不应该到期', () => {
    expect(isDueToday(Date.now() + 86400000)).toBe(false)
  })

  test('7天后不应该到期', () => {
    expect(isDueToday(Date.now() + 86400000 * 7)).toBe(false)
  })
})

// ============ daysUntilNext ============
describe('daysUntilNext', () => {
  test('今天 = 0天', () => {
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    expect(daysUntilNext(today.getTime())).toBe(0)
  })

  test('明天 = 1天', () => {
    expect(daysUntilNext(Date.now() + 86400000)).toBe(1)
  })

  test('3天后 = 3天', () => {
    expect(daysUntilNext(Date.now() + 86400000 * 3)).toBe(3)
  })

  test('昨天 = -1天（已逾期）', () => {
    expect(daysUntilNext(Date.now() - 86400000)).toBe(-1)
  })
})

// ============ genId ============
describe('genId', () => {
  test('生成非空字符串', () => {
    const id = genId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  test('前缀为 p_', () => {
    expect(genId()).toMatch(/^p_/)
  })

  test('每次生成的ID不同', () => {
    const id1 = genId()
    const id2 = genId()
    expect(id1).not.toBe(id2)
  })

  test('连续生成100个ID都不同', () => {
    const ids = new Set()
    for (let i = 0; i < 100; i++) {
      ids.add(genId())
    }
    expect(ids.size).toBe(100)
  })
})

// ============ getDifficultyColor ============
describe('getDifficultyColor', () => {
  test('超简单 = 绿色', () => {
    expect(getDifficultyColor('超简单')).toBe('#4CAF50')
  })

  test('简单 = 浅绿', () => {
    expect(getDifficultyColor('简单')).toBe('#8BC34A')
  })

  test('中等 = 橙色', () => {
    expect(getDifficultyColor('中等')).toBe('#FF9800')
  })

  test('较难 = 红色', () => {
    expect(getDifficultyColor('较难')).toBe('#F44336')
  })

  test('未知 = 灰色', () => {
    expect(getDifficultyColor('地狱级')).toBe('#999')
  })
})

// ============ 植物数据完整性检查 ============
describe('植物数据库', () => {
  const { plants, categories, taskTypes } = require('../../miniprogram/data/plants')

  test('植物数量 >= 10', () => {
    expect(plants.length).toBeGreaterThanOrEqual(10)
  })

  test('每个植物都有必要字段', () => {
    plants.forEach(p => {
      expect(p.id).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(p.latin).toBeTruthy()
      expect(p.category).toBeTruthy()
      expect(p.emoji).toBeTruthy()
      expect(p.care).toBeDefined()
    })
  })

  test('每个植物的养护信息完整', () => {
    plants.forEach(p => {
      expect(p.care.light).toBeTruthy()
      expect(p.care.waterDays).toBeGreaterThan(0)
      expect(p.care.waterAmount).toBeTruthy()
      expect(p.care.temperature).toBeTruthy()
      expect(p.care.difficulty).toBeTruthy()
    })
  })

  test('植物ID不重复', () => {
    const ids = plants.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('分类包含"全部"', () => {
    expect(categories.some(c => c.id === 'all')).toBe(true)
  })

  test('所有植物的category都有对应分类', () => {
    const catIds = categories.filter(c => c.id !== 'all').map(c => c.name)
    plants.forEach(p => {
      expect(catIds).toContain(p.category)
    })
  })

  test('taskTypes 包含浇水', () => {
    expect(taskTypes.some(t => t.id === 'water')).toBe(true)
  })

  test('每个植物至少有1条贴士', () => {
    plants.forEach(p => {
      expect(p.tips.length).toBeGreaterThanOrEqual(1)
    })
  })
})
