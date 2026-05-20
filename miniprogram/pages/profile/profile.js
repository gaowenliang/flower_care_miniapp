// pages/profile/profile.js - 重构版
const storage = require('../../utils/storage')

Page({
  data: {
    stats: null,
    garden: [],
    settings: null
  },

  onShow() {
    this.loadStats()
  },

  loadStats() {
    const stats = storage.getStats()
    const garden = storage.getGarden()
    const settings = storage.getSettings()
    this.setData({ stats, garden, settings })
  },

  // 切换提醒
  toggleReminder(e) {
    const settings = this.data.settings
    settings.reminderEnabled = e.detail.value
    storage.saveSettings(settings)
    this.setData({ settings })
  },

  // 修改提醒时间
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
          wx.showToast({ title: '已清除', icon: 'none' })
        }
      }
    })
  },

  showAbout() {
    wx.showModal({
      title: '🪴 养花助手',
      content: '版本：v1.0.0\n\n帮助你更好地照顾每一棵植物\n浇水提醒 · 养护日历 · 成长记录',
      showCancel: false
    })
  }
})
