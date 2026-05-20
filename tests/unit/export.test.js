// tests/unit/export.test.js
global.wx = {
  getStorageSync: jest.fn((key) => {
    if (key === 'myGarden') return [
      { id: 'p1', nickname: '大龟', location: '阳台', addedAt: Date.now() - 10 * 86400000 }
    ]
    if (key === 'careTasks') return [
      { id: 't1', userPlantId: 'p1', type: 'water', typeName: '浇水', enabled: true, nextDate: Date.now() + 86400000, intervalDays: 7 }
    ]
    if (key === 'careRecords') return [
      { id: 'r1', userPlantId: 'p1', typeName: '浇水', date: Date.now() - 86400000, note: '浇透了' }
    ]
    return null
  }),
  setStorageSync: jest.fn(),
  setClipboardData: jest.fn(({ success }) => success && success()),
  showToast: jest.fn()
}

const { generateReport, generateGardenReport } = require('../../miniprogram/utils/export')

describe('export', () => {
  describe('generateReport', () => {
    test('植物不存在返回null', () => {
      expect(generateReport('nonexistent')).toBeNull()
    })

    test('生成报告包含昵称和养护天数', () => {
      const report = generateReport('p1')
      expect(report).toContain('大龟')
      expect(report).toContain('10 天')
      expect(report).toContain('阳台')
    })

    test('包含养护记录数', () => {
      const report = generateReport('p1')
      expect(report).toContain('1 条')
    })

    test('包含最近养护记录', () => {
      const report = generateReport('p1')
      expect(report).toContain('浇透了')
    })

    test('包含养花助手签名', () => {
      const report = generateReport('p1')
      expect(report).toContain('养花助手')
    })
  })

  describe('generateGardenReport', () => {
    test('花园为空返回null', () => {
      wx.getStorageSync = jest.fn(() => [])
      expect(generateGardenReport()).toBeNull()
      // 恢复
      wx.getStorageSync = jest.fn((key) => {
        if (key === 'myGarden') return [{ id: 'p1', nickname: '大龟', addedAt: Date.now() }]
        return []
      })
    })

    test('生成花园报告', () => {
      wx.getStorageSync = jest.fn((key) => {
        if (key === 'myGarden') return [{ id: 'p1', nickname: '大龟', addedAt: Date.now() }]
        if (key === 'careRecords') return []
        if (key === 'careTasks') return []
        return null
      })
      const report = generateGardenReport()
      expect(report).toContain('1 棵植物')
      expect(report).toContain('大龟')
    })
  })
})
