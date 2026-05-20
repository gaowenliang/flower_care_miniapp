// tests/unit/disease.test.js
const { diagnose, getAllDiseases, DISEASES } = require('../../miniprogram/utils/disease')

describe('disease — 病害诊断', () => {
  describe('getAllDiseases', () => {
    test('至少有8种病害', () => {
      expect(getAllDiseases().length).toBeGreaterThanOrEqual(8)
    })

    test('每个病害都有必要字段', () => {
      DISEASES.forEach(d => {
        expect(d.id).toBeTruthy()
        expect(d.name).toBeTruthy()
        expect(d.symptoms.length).toBeGreaterThan(0)
        expect(d.solutions.length).toBeGreaterThan(0)
        expect(['low', 'medium', 'high']).toContain(d.severity)
      })
    })
  })

  describe('diagnose', () => {
    test('空输入返回空数组', () => {
      expect(diagnose('')).toEqual([])
      expect(diagnose(null)).toEqual([])
      expect(diagnose('   ')).toEqual([])
    })

    test('黄叶能诊断出结果', () => {
      const results = diagnose('黄叶')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(r => r.name === '黄叶病')).toBe(true)
    })

    test('"叶子发黄"也能诊断', () => {
      const results = diagnose('叶子发黄')
      expect(results.some(r => r.name === '黄叶病')).toBe(true)
    })

    test('黑斑能诊断出叶斑病', () => {
      const results = diagnose('叶子上有黑斑')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(r => r.name === '叶斑病')).toBe(true)
    })

    test('白粉能诊断出白粉病', () => {
      const results = diagnose('叶子上长了白色粉末')
      expect(results.some(r => r.name === '白粉病')).toBe(true)
    })

    test('烂根能诊断出烂根病', () => {
      const results = diagnose('根部发黑发臭')
      expect(results.some(r => r.name === '烂根')).toBe(true)
    })

    test('虫子能诊断出虫害', () => {
      const results = diagnose('发现红蜘蛛和小虫子')
      expect(results.some(r => r.name.includes('红蜘蛛') || r.name.includes('介壳虫'))).toBe(true)
    })

    test('多症状输入有结果', () => {
      const results = diagnose('叶子发黄而且有黑斑')
      expect(results.length).toBeGreaterThan(0)
    })

    test('无关输入返回空', () => {
      const results = diagnose('今天天气真好')
      expect(results.length).toBe(0)
    })

    test('最多返回3个结果', () => {
      const results = diagnose('黄叶 黑斑 白粉 烂根 虫子')
      expect(results.length).toBeLessThanOrEqual(3)
    })

    test('结果按匹配数排序', () => {
      const results = diagnose('叶子发黄黄叶')
      if (results.length > 1) {
        expect(results[0].matchCount).toBeGreaterThanOrEqual(results[1].matchCount)
      }
    })

    test('结果包含confidence', () => {
      const results = diagnose('黄叶')
      results.forEach(r => {
        expect(r.confidence).toBeGreaterThan(0)
        expect(r.confidence).toBeLessThanOrEqual(100)
      })
    })
  })
})
