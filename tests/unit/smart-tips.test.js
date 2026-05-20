// tests/unit/smart-tips.test.js
const { getSeason, SEASON_NAMES } = require('../../miniprogram/utils/smart-tips')

describe('smart-tips', () => {
  describe('getSeason', () => {
    test('3月=春天', () => expect(getSeason(3)).toBe('spring'))
    test('4月=春天', () => expect(getSeason(4)).toBe('spring'))
    test('5月=春天', () => expect(getSeason(5)).toBe('spring'))
    test('6月=夏天', () => expect(getSeason(6)).toBe('summer'))
    test('7月=夏天', () => expect(getSeason(7)).toBe('summer'))
    test('8月=夏天', () => expect(getSeason(8)).toBe('summer'))
    test('9月=秋天', () => expect(getSeason(9)).toBe('autumn'))
    test('10月=秋天', () => expect(getSeason(10)).toBe('autumn'))
    test('11月=秋天', () => expect(getSeason(11)).toBe('autumn'))
    test('12月=冬天', () => expect(getSeason(12)).toBe('winter'))
    test('1月=冬天', () => expect(getSeason(1)).toBe('winter'))
    test('2月=冬天', () => expect(getSeason(2)).toBe('winter'))
  })

  describe('SEASON_NAMES', () => {
    test('四季都有中文名', () => {
      expect(SEASON_NAMES.spring).toBe('春天')
      expect(SEASON_NAMES.summer).toBe('夏天')
      expect(SEASON_NAMES.autumn).toBe('秋天')
      expect(SEASON_NAMES.winter).toBe('冬天')
    })
    test('只有4个季节', () => {
      expect(Object.keys(SEASON_NAMES).length).toBe(4)
    })
  })
})
