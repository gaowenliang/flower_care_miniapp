// pages/profile/profile.js - v3
const storage = require('../../utils/storage')

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
    showAchievements: false
  },

  onShow() {
    this.loadStats()
    this.loadAchievements()
  },

  loadStats() {
    const stats = storage.getStats()
    // 把 families 对象转成排序数组给 wxml 用
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

  // 云同步
  async syncToCloud() {
    const cloudSync = require('../../utils/cloud-sync')
    if (!cloudSync.isCloudEnabled()) {
      wx.showToast({ title: '云开发未启用', icon: 'none' })
      return
    }
    wx.showLoading({ title: '同步中...' })
    const localData = {
      garden: storage.getGarden(),
      tasks: storage.getTasks(),
      records: storage.getRecords(),
      settings: storage.getSettings()
    }
    const result = await cloudSync.uploadAll(localData)
    wx.hideLoading()
    if (result.success) {
      wx.showToast({ title: '同步成功 ☁️', icon: 'none' })
    } else {
      wx.showToast({ title: '同步失败', icon: 'none' })
    }
  },

  async syncFromCloud() {
    wx.showLoading({ title: '恢复中...' })
    const cloudSync = require('../../utils/cloud-sync')
    const result = await cloudSync.syncOnStartup(storage)
    wx.hideLoading()
    if (result.synced) {
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
      content: '版本：v1.2.0\n\n帮助你更好地照顾每一棵植物\n浇水提醒 · 养护日历 · 成长记录\n智能贴士 · AI识花 · 病害诊断 · 成就系统',
      showCancel: false
    })
  }
})
