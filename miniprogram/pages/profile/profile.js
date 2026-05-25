// pages/profile/profile.js - v3 + 家庭模式入口
const storage = require('../../utils/storage')
const family = require('../../utils/family')
const util = require('../../utils/util')

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
    familyName: '',
    statsLoading: false,
    userAvatar: '',
    expandedFamily: ''
  },

  async onShow() {
    this.setData({ statsLoading: true })
    // 读取用户头像
    try { this.setData({ userAvatar: wx.getStorageSync('_user_avatar') || '' }) } catch (e) {}
    await this.loadFamilyStatus()
    this.loadStats()
    this.loadAchievements()
    this.loadMonthlyStats()
    this.loadCostStats()
    this.setData({ statsLoading: false })
  },

  async loadStats() {
    if (this.data.inFamily) {
      // 家庭模式：刷新缓存后算统计
      await family.getPlants(true).catch(() => {})
      await family.getTasks('', true).catch(() => {})
      await family.getRecords('', 100, true).catch(() => {})
      const plants = family.getCachedPlants()
      const tasks = family.getCachedTasks('')
      const records = family.getCachedRecords('')
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const todayTs = today.getTime()
      const dueToday = tasks.filter(t => t.enabled && t.nextDate && t.nextDate <= todayTs + 86400000).length
      const stats = {
        totalPlants: plants.length,
        totalTasks: tasks.length,
        activeTasks: tasks.filter(t => t.enabled).length,
        dueToday,
        totalRecords: records.length,
        categories: {},
        families: {}
      }
      // 按科(family)归类，排除嘎了的植物
      const familyPlants = {}
      const alivePlants = plants.filter(p => !p.dead)
      alivePlants.forEach(p => {
        const fam = p.family || '其他'
        if (!familyPlants[fam]) familyPlants[fam] = []
        familyPlants[fam].push(p)
      })
      const familyList = Object.entries(familyPlants)
        .map(([name, items]) => ({
          name,
          count: items.length,
          percent: alivePlants.length > 0 ? Math.round(items.length / alivePlants.length * 100) : 0,
          plants: items.map(p => ({ id: p._id || p.id, name: p.nickname || p.name, emoji: p.emoji || '🌱', location: p.location || '' }))
        }))
        .sort((a, b) => b.count - a.count)
      // bar 宽度：最多的顶满 100%
      const maxCount = familyList.length > 0 ? familyList[0].count : 1
      familyList.forEach(f => { f.barWidth = maxCount > 0 ? Math.round(f.count / maxCount * 100) : 0 })
      this.setData({ stats, familyList, settings: storage.getSettings() })
    } else {
      const stats = storage.getStats()
      const garden = storage.getGarden()
      const aliveGarden = garden.filter(p => !p.dead)
      const familyPlants = {}
      aliveGarden.forEach(p => {
        const fam = p.family || '其他'
        if (!familyPlants[fam]) familyPlants[fam] = []
        familyPlants[fam].push(p)
      })
      let familyList = Object.entries(familyPlants)
        .map(([name, items]) => ({
          name,
          count: items.length,
          percent: aliveGarden.length > 0 ? Math.round(items.length / aliveGarden.length * 100) : 0,
          plants: items.map(p => ({ id: p.id, name: p.nickname || p.name, emoji: p.emoji || '🌱', location: p.location || '' }))
        }))
        .sort((a, b) => b.count - a.count)
      // bar 宽度：最多的顶满 100%
      const maxCount = familyList.length > 0 ? familyList[0].count : 1
      familyList.forEach(f => { f.barWidth = maxCount > 0 ? Math.round(f.count / maxCount * 100) : 0 })
      this.setData({ stats, familyList, settings: storage.getSettings() })
    }
  },

  async loadFamilyStatus() {
    const info = await family.refreshFamilyInfo()
    const familyAvatar = info.family ? info.family.avatar || '' : ''
    const userAvatar = this.data.inFamily ? familyAvatar : (wx.getStorageSync('_user_avatar') || '')
    this.setData({
      inFamily: info.success && info.inFamily,
      familyName: info.family ? info.family.name : '',
      userAvatar
    })
  },

  goFamily() {
    wx.navigateTo({ url: '/pages/family/family' })
  },

  getFamilyRetroRemaining() {
    try {
      const retroData = wx.getStorageSync('_family_retro') || {}
      const now = new Date()
      const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`
      const used = (retroData[monthKey] || []).length
      return Math.max(0, 3 - used)
    } catch (e) { return 3 }
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
      retroRemaining: this.data.inFamily ? this.getFamilyRetroRemaining() : storage.getRetroRemaining()
    })
  },

  toggleAchievements() {
    this.setData({ showAchievements: !this.data.showAchievements })
  },

  toggleFamily(e) {
    const name = e.currentTarget.dataset.name
    this.setData({ expandedFamily: this.data.expandedFamily === name ? '' : name })
  },

  goPlantDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/plant-detail/plant-detail?id=${id}` })
  },

  loadMonthlyStats() {
    const records = this.data.inFamily ? family.getCachedRecords('') : storage.getRecords()
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

  loadCostStats() {
    const garden = this.data.inFamily
      ? family.getCachedPlants().map(p => ({ ...p, id: p._id }))
      : storage.getGarden()
    const records = this.data.inFamily
      ? family.getCachedRecords('')
      : storage.getRecords()

    // 购入总价（按品类分组）
    const categoryCost = {}
    let totalPurchase = 0
    garden.forEach(p => {
      const cat = p.category || '其他'
      const price = p.purchasePrice || 0
      if (price > 0) {
        categoryCost[cat] = (categoryCost[cat] || 0) + price
        totalPurchase += price
      }
    })

    // 维护花费
    const costRecords = records.filter(r => r.type === 'cost' && r.cost > 0)
    const totalMaintenance = costRecords.reduce((sum, r) => sum + (r.cost || 0), 0)

    // 按月维护花费（最近6个月）
    const monthlyCost = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime()
      const monthStart = d.getTime()
      const monthTotal = costRecords.filter(r => r.date >= monthStart && r.date < monthEnd).reduce((s, r) => s + (r.cost || 0), 0)
      monthlyCost.push({
        month: `${d.getMonth() + 1}月`,
        cost: monthTotal,
        height: '0rpx'
      })
    }
    const maxMonthCost = Math.max(1, ...monthlyCost.map(m => m.cost))
    monthlyCost.forEach(m => { m.height = (m.cost / maxMonthCost * 80) + 'rpx' })

    // 品类花费列表
    const categoryCostList = Object.entries(categoryCost)
      .map(([name, total]) => {
        const count = garden.filter(p => (p.category || '其他') === name).length
        return { name, total, count, avg: (total / (count || 1)).toFixed(1) }
      })
      .sort((a, b) => b.total - a.total)
    const maxCatCost = Math.max(1, ...categoryCostList.map(c => c.total))
    categoryCostList.forEach(c => { c.percent = (c.total / maxCatCost * 100).toFixed(0) })

    // 最近花费记录
    const recentCosts = costRecords.sort((a, b) => b.date - a.date).slice(0, 10)
    recentCosts.forEach(r => {
      r.dateStr = util.formatDate(r.date)
      const plant = garden.find(p => p.id === (r.userPlantId || r.plantId))
      r.plantName = plant ? plant.nickname : '未知'
    })

    this.setData({
      costStats: {
        totalPurchase,
        totalMaintenance,
        totalAll: totalPurchase + totalMaintenance,
        plantCount: garden.filter(p => p.purchasePrice > 0).length
      },
      categoryCostList,
      monthlyCost,
      recentCosts
    })
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
    if (this.data.inFamily) {
      wx.showModal({
        title: '⚠️ 提示',
        content: '家庭模式下的数据在云端共享，无法单独清除。如需退出家庭，请在家庭管理中操作。',
        showCancel: false
      })
      return
    }
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
      content: '版本：v1.3.0\n\n帮助你更好地照顾每一棵植物\n浇水提醒 · 养护日历 · 成长记录\n智能贴士 · AI识花 · 病害诊断 · 成就系统\n家庭花园 · 花费追踪',
      showCancel: false
    })
  },

  changeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: async (res) => {
        const imageUtil = require('../../utils/image')
        try {
          const photoUrl = await imageUtil.uploadImage(res.tempFiles[0].tempFilePath)
          this.setData({ userAvatar: photoUrl })
          if (this.data.inFamily) {
            // 家庭模式：更新家庭头像到云端
            const info = await family.refreshFamilyInfo()
            if (info.family) {
              await wx.cloud.callFunction({ name: 'familyManage', data: { action: 'updateFamilyAvatar', data: { avatar: photoUrl } } })
            }
          } else {
            try { wx.setStorageSync('_user_avatar', photoUrl) } catch (e) {}
          }
          wx.showToast({ title: '头像已更新', icon: 'none' })
        } catch (e) {
          wx.showToast({ title: '上传失败', icon: 'none' })
        }
      }
    })
  }
})