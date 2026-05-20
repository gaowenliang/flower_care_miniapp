// pages/profile/profile.js - 打磨版
const storage = require('../../utils/storage')

Page({
  data: {
    stats: null,
    garden: [],
    settings: null,
    achievements: [],
    unlockedCount: 0,
    totalAchievements: 0,
    careStreak: 0,
    showAchievements: false
  },

  onShow() {
    this.loadStats()
    this.loadAchievements()
  },

  loadStats() {
    const stats = storage.getStats()
    const garden = storage.getGarden()
    const settings = storage.getSettings()
    this.setData({ stats, garden, settings })
  },

  loadAchievements() {
    const achievement = require('../../utils/achievement')
    // 检查新成就
    achievement.checkAchievements()
    const all = achievement.getAll()
    const achievementExport = require('../../utils/export')
    const streak = achievement.getCareStreak()

    this.setData({
      achievements: all,
      unlockedCount: all.filter(a => a.unlocked).length,
      totalAchievements: all.length,
      careStreak: streak
    })
  },

  toggleAchievements() {
    this.setData({ showAchievements: !this.data.showAchievements })
  },

  // 导出花园报告
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
      confirmColor: '#FF5252',
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
      content: '版本：v1.1.0\n\n帮助你更好地照顾每一棵植物\n浇水提醒 · 养护日历 · 成长记录 · 智能贴士 · 成就系统',
      showCancel: false
    })
  }
})
