// pages/index/index.js - 首页：我的花园（打磨版）
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const subscribe = require('../../utils/subscribe')

Page({
  data: {
    garden: [],
    todayTasks: [],
    hasPlants: false,
    stats: null,
    showTip: false,
    tipText: '',
    searchKeyword: '',
    searching: false,
    filteredGarden: []
  },

  onShow() {
    this.loadGarden()
    this.loadTodayTasks()
    this.loadStats()
    subscribe.checkAndNotify()
  },

  loadGarden() {
    let garden = storage.getGarden()
    garden.forEach(plant => {
      const tasks = storage.getTasksByPlant(plant.id).filter(t => t.enabled)
      const dueCount = tasks.filter(t => util.isDueToday(t.nextDate)).length
      plant.statusEmoji = dueCount > 0 ? '🥺' : '😊'
      plant.hasOverdue = dueCount > 0
      plant.dueCount = dueCount
      plant.addedDays = Math.floor((Date.now() - plant.addedAt) / 86400000)
    })
    // 逾期排最前，然后按添加时间
    garden.sort((a, b) => {
      if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1
      return b.addedAt - a.addedAt
    })
    this.setData({ garden, hasPlants: garden.length > 0 })
    this.applyFilter()
  },

  loadTodayTasks() {
    const dueTasks = storage.getDueTasks()
    const garden = storage.getGarden()

    dueTasks.forEach(task => {
      const plant = garden.find(p => p.id === task.userPlantId)
      task.plantName = plant ? plant.nickname : '未知植物'
      task.plantEmoji = plant ? plant.emoji : '🌱'
      task.plantId = task.userPlantId
      const daysOver = Math.abs(util.daysUntilNext(task.nextDate))
      task.daysText = daysOver === 0 ? '今天' : `逾期${daysOver}天`
    })

    this.setData({ todayTasks: dueTasks })
  },

  loadStats() {
    const stats = storage.getStats()
    this.setData({ stats })
  },

  // 搜索
  onSearchInput(e) {
    const keyword = e.detail.value.trim().toLowerCase()
    this.setData({ searchKeyword: keyword, searching: keyword.length > 0 })
    this.applyFilter()
  },

  clearSearch() {
    this.setData({ searchKeyword: '', searching: false })
    this.applyFilter()
  },

  applyFilter() {
    const { garden, searchKeyword } = this.data
    if (!searchKeyword) {
      this.setData({ filteredGarden: garden })
      return
    }
    const filtered = garden.filter(p =>
      p.nickname.toLowerCase().includes(searchKeyword) ||
      p.name.toLowerCase().includes(searchKeyword) ||
      (p.category && p.category.includes(searchKeyword))
    )
    this.setData({ filteredGarden: filtered })
  },

  goAddPlant() {
    wx.switchTab({ url: '/pages/add-plant/add-plant' })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/plant-detail/plant-detail?id=${id}` })
  },

  completeTask(e) {
    const taskId = e.currentTarget.dataset.id
    storage.completeTask(taskId)

    const task = storage.getTasks().find(t => t.id === taskId)
    if (task) {
      this.setData({ showTip: true, tipText: `${task.typeName}完成！` })
      setTimeout(() => this.setData({ showTip: false }), 2000)
    }

    // 检查成就
    const achievement = require('../../utils/achievement')
    const newBadges = achievement.checkAchievements()
    if (newBadges.length > 0) {
      const badge = newBadges[0]
      setTimeout(() => {
        wx.showToast({ title: `🏆 解锁成就：${badge.name}`, icon: 'none', duration: 3000 })
      }, 2200)
    }

    this.loadTodayTasks()
    this.loadGarden()
    this.loadStats()
  },

  // 批量完成今日所有任务
  completeAllTasks() {
    const tasks = this.data.todayTasks
    if (tasks.length === 0) return

    wx.showModal({
      title: '一键完成',
      content: `确认完成今天的 ${tasks.length} 项养护任务？`,
      success: (res) => {
        if (res.confirm) {
          tasks.forEach(t => storage.completeTask(t.id))
          this.setData({ showTip: true, tipText: `${tasks.length}项任务全部完成！` })
          setTimeout(() => this.setData({ showTip: false }), 2000)
          this.loadTodayTasks()
          this.loadGarden()
          this.loadStats()
        }
      }
    })
  },

  onPullDownRefresh() {
    this.loadGarden()
    this.loadTodayTasks()
    this.loadStats()
    wx.stopPullDownRefresh()
  },

  onShareAppMessage() {
    const count = this.data.garden.length
    return {
      title: `我在养${count}棵植物，快来一起养花吧！🌸`,
      path: '/pages/index/index'
    }
  }
})
