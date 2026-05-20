// pages/index/index.js - 首页：我的花园（重构版）
const app = getApp()
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
    tipText: ''
  },

  onShow() {
    this.loadGarden()
    this.loadTodayTasks()
    this.loadStats()
    // 检查订阅提醒
    subscribe.checkAndNotify()
  },

  loadGarden() {
    const garden = storage.getGarden()
    garden.forEach(plant => {
      const tasks = storage.getTasksByPlant(plant.id).filter(t => t.enabled)
      const dueCount = tasks.filter(t => util.isDueToday(t.nextDate)).length
      plant.statusEmoji = dueCount > 0 ? '🥺' : '😊'
      plant.hasOverdue = dueCount > 0
      plant.dueCount = dueCount
      plant.addedDays = Math.floor((Date.now() - plant.addedAt) / 86400000)
    })
    this.setData({ garden, hasPlants: garden.length > 0 })
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
      this.setData({ showTip: true, tipText: `${task.typeName}完成！下次${util.daysUntilNext(task.nextDate)}天后` })
      setTimeout(() => this.setData({ showTip: false }), 2000)
    }

    this.loadTodayTasks()
    this.loadGarden()
    this.loadStats()
  },

  onPullDownRefresh() {
    this.loadGarden()
    this.loadTodayTasks()
    this.loadStats()
    wx.stopPullDownRefresh()
  }
})
