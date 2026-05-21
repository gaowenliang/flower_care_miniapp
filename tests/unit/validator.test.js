// tests/unit/validator.test.js
const { describe, it, expect } = require('../helpers')
const { validateNickname, validateRoomName, validateNote, validateInterval } = require('../../miniprogram/utils/validator')

describe('validator', () => {
  describe('validateNickname', () => {
    it('正常名称通过', () => {
      const r = validateNickname('小绿')
      expect(r.valid).toBe(true)
      expect(r.value).toBe('小绿')
    })

    it('空名称拒绝', () => {
      expect(validateNickname('').valid).toBe(false)
      expect(validateNickname('   ').valid).toBe(false)
    })

    it('超长名称拒绝', () => {
      expect(validateNickname('一二三四五六七八九十abcdefghijklmnop').valid).toBe(false)
    })

    it('HTML标签拒绝', () => {
      expect(validateNickname('<script>alert(1)</script>').valid).toBe(false)
    })

    it('前后空格被trim', () => {
      const r = validateNickname('  花花  ')
      expect(r.valid).toBe(true)
      expect(r.value).toBe('花花')
    })
  })

  describe('validateRoomName', () => {
    it('正常名称通过', () => {
      expect(validateRoomName('阳台').valid).toBe(true)
    })

    it('超过6字拒绝', () => {
      expect(validateRoomName('一二三四五六七').valid).toBe(false)
    })

    it('空名拒绝', () => {
      expect(validateRoomName('').valid).toBe(false)
    })
  })

  describe('validateNote', () => {
    it('正常内容通过', () => {
      expect(validateNote('今天浇水了，长得不错').valid).toBe(true)
    })

    it('空内容拒绝', () => {
      expect(validateNote('').valid).toBe(false)
    })

    it('超过500字拒绝', () => {
      expect(validateNote('a'.repeat(501)).valid).toBe(false)
    })
  })

  describe('validateInterval', () => {
    it('正常天数通过', () => {
      const r = validateInterval(7)
      expect(r.valid).toBe(true)
      expect(r.value).toBe(7)
    })

    it('小于1拒绝', () => {
      expect(validateInterval(0).valid).toBe(false)
      expect(validateInterval(-1).valid).toBe(false)
    })

    it('超过90拒绝', () => {
      expect(validateInterval(91).valid).toBe(false)
    })

    it('非数字拒绝', () => {
      expect(validateInterval('abc').valid).toBe(false)
    })
  })
})
