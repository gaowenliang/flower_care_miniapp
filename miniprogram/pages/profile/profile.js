// pages/profile/profile.js - v3 + 家庭模式入口
const storage = require('../../utils/storage')
const familyManager = require('../../utils/family/manager')

Page({
  data: {
    stats: null,
    garden: [],
    settings: null,
    achievements: [],
    achGroups: {},
    achProgress: { done: 0, total: 0, percent: 0 },
    unlockedCount: 0,
    totalAchievements: 0,
    careStreak: 0,
    showAchievements: false,
    // 家庭模式
    inFamily: false,
    familyName: ''
  },

  onShow() {
    this.loadStats()
    this.loadAchievements()
    this.loadMonthlyStats()
    this.loadFamilyStatus()
  },

  loadStats() {
    const stats = storage.getStats()
    let familyList = []
    if (stats.families) {
      familyList = Object.entries(stats.families)
        .map(([name, count]) => ({
          name,
          count,
          percent: stats.totalPlants > 0 ? Math.round(count / stats.totalPlants * 100) : 0
        }))
        .sort((a, b) => b.count - a.count)
    }
    this.setData({ stats, familyList, settings: storage.getSettings() })
  },

  loadFamilyStatus() {
    const familyInfo = familyManager.getFamilyInfo()
    this.setData({
      inFamily: familyInfo.inFamily,
      familyName: familyInfo.family ? familyInfo.family.name : ''
    })
  },

  goFamily() {
    wx.navigateTo({ url: '/pages/family/family' })
  },

  // 云同步
  async syncToCloud() {
    const cloudSync = require('../../utils/cloud-sync')
    if (!cloudSync.isCloudEnabled()) {
      wx.showToast({ title: '云开发未启用', icon: 'none' })
      return
    }
    wx.showLoading({ title: '备份中...' })
    const result = await cloudSync.uploadAll(storage)
    wx.hideLoading()
    if (result.success) {
      wx.showToast({ title: '备份成功 ☁️', icon: 'none' })
    } else {
      wx.showToast({ title: '备份失败', icon: 'none' })
    }
  },

  async syncFromCloud() {
    wx.showLoading({ title: '恢复中...' })
    const cloudSync = require('../../utils/cloud-sync')
    const result = await cloudSync.downloadAll(storage)
    wx.hideLoading()
    if (result.success) {
      this.loadStats()
      this.loadAchievements()
      wx.showToast({ title: '恢复成功 ☁️', icon: 'none' })
    } else {
      wx.showToast({ title: '恢复失败', icon: 'none' })
    }
  },

  loadAchievements() {
    const achievement = require('../../utils/achievement')
    achievement.checkAchievements()
    const all = achievement.getAll()
    const groups = achievement.getGrouped()
    const progress = achievement.getProgress()
    const streak = achievement.getCareStreak()

    this.setData({
      achievements: all,
      achGroups: groups,
      achProgress: progress,
      careStreak: streak,
      retroRemaining: storage.getRetroRemaining()
    })
  },

  toggleAchievements() {
    this.setData({ showAchievements: !this.data.showAchievements })
  },

  loadMonthlyStats() {
    const records = storage.getRecords()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const monthRecords = records.filter(r => r.date >= monthStart && r.type !== 'photo' && r.type !== 'note')

    const typeCount = {}
    monthRecords.forEach(r => {
      const name = r.typeName || '其他'
      typeCount[name] = (typeCount[name] || 0) + 1
    })

    const monthlyStats = Object.entries(typeCount)
      .map(([label, count]) => {
        const emojiMap = { '浇水': '💧', '施肥': '🧪', '修剪': '✂️', '换盆': '🏺', '喷药': '💉', '补卡': '🔖' }
        return { emoji: emojiMap[label] || '📝', label, value: count + '次' }
      })

    if (monthlyStats.length === 0) {
      monthlyStats.push({ emoji: '📝', label: '养护记录', value: '0次' })
    }

    const weekDays = ['一', '二', '三', '四', '五', '六', '日']
    const today = now.getDay() === 0 ? 6 : now.getDay() - 1
    const weekBars = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      const dayEnd = dayStart + 86400000
      const dayCount = records.filter(r => r.date >= dayStart && r.date < dayEnd && r.type !== 'photo' && r.type !== 'note').length
      const maxCount = Math.max(1, ...Array.from({ length: 7 }, (_, j) => {
        const dd = new Date(now); dd.setDate(dd.getDate() - (6 - j))
        const ds = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate()).getTime()
        return records.filter(r => r.date >= ds && r.date < ds + 86400000 && r.type !== 'photo' && r.type !== 'note').length
      }))
      const dayIdx = (today - i + 7) % 7
      weekBars.push({
        day: weekDays[dayIdx],
        count: dayCount,
        height: (dayCount / maxCount * 100) + 'rpx'
      })
    }

    this.setData({ monthlyStats, weekBars })
  },

  goDiagnose() {
    wx.navigateTo({ url: '/pages/diagnose/diagnose' })
  },

  exportGardenReport() {
    const exportUtil = require('../../utils/export')
    const text = exportUtil.generateGardenReport()
    if (!text) {
      wx.showToast({ title: '花园是空的', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '报告已复制', icon: 'none' })
    })
  },

  toggleReminder(e) {
    const settings = this.data.settings
    settings.reminderEnabled = e.detail.value
    storage.saveSettings(settings)
    this.setData({ settings })
    if (settings.reminderEnabled) {
      const subscribe = require('../../utils/subscribe')
      subscribe.checkAndNotify(true)
    }
  },

  changeReminderTime(e) {
    const settings = this.data.settings
    settings.reminderTime = e.detail.value
    storage.saveSettings(settings)
    this.setData({ settings })
  },

  clearData() {
    wx.showModal({
      title: '⚠️ 清除所有数据',
      content: '将清除你的花园和所有养护记录，无法恢复！',
      confirmColor: '#2E7D32',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          this.loadStats()
          this.loadAchievements()
          wx.showToast({ title: '已清除', icon: 'none' })
        }
      }
    })
  },

  showAbout() {
    wx.showModal({
      title: '🪴 养花助手',
      content: '版本：v1.2.0\n\n帮助你更好地照顾每一棵植物\n浇水提醒 · 养护日历 · 成长记录\n智能贴士 · AI识花 · 病害诊断 · 成就系统',
      showCancel: false
    })
  }
})