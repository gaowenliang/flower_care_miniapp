// utils/storage.js - 数据存储管理

const util = require('./util')

/**
 * StorageManager - 管理所有本地存储操作
 * 统一数据操作入口，保证数据一致性
 */
const StorageManager = {
  KEYS: {
    GARDEN: 'myGarden',
    TASKS: 'careTasks',
    PLANT_DB: 'plantDB',
    RECORDS: 'careRecords',
    SETTINGS: 'userSettings',
    SUBSCRIBE: 'subscribeState'
  },

  // ========== 花园 ==========

  getGarden() {
    return wx.getStorageSync(this.KEYS.GARDEN) || []
  },

  saveGarden(garden) {
    wx.setStorageSync(this.KEYS.GARDEN, garden)
  },

  addPlant(userPlant) {
    const garden = this.getGarden()
    garden.push(userPlant)
    this.saveGarden(garden)
    return garden
  },

  removePlant(plantId) {
    let garden = this.getGarden()
    garden = garden.filter(p => p.id !== plantId)
    this.saveGarden(garden)
    // 同时删除相关任务
    this.removeTasksByPlant(plantId)
    // 同时删除相关记录
    this.removeRecordsByPlant(plantId)
    return garden
  },

  updatePlant(plantId, updates) {
    const garden = this.getGarden()
    const idx = garden.findIndex(p => p.id === plantId)
    if (idx !== -1) {
      garden[idx] = { ...garden[idx], ...updates, updatedAt: Date.now() }
      this.saveGarden(garden)
    }
    return garden
  },

  getPlantById(plantId) {
    return this.getGarden().find(p => p.id === plantId) || null
  },

  // ========== 任务 ==========

  getTasks() {
    return wx.getStorageSync(this.KEYS.TASKS) || []
  },

  saveTasks(tasks) {
    wx.setStorageSync(this.KEYS.TASKS, tasks)
  },

  getTasksByPlant(plantId) {
    return this.getTasks().filter(t => t.userPlantId === plantId)
  },

  getActiveTasks() {
    return this.getTasks().filter(t => t.enabled)
  },

  getDueTasks() {
    return this.getActiveTasks().filter(t => util.isDueToday(t.nextDate))
  },

  addTask(task) {
    const tasks = this.getTasks()
    tasks.push(task)
    this.saveTasks(tasks)
    return tasks
  },

  completeTask(taskId) {
    const tasks = this.getTasks()
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      task.lastDoneDate = Date.now()
      task.nextDate = util.nextCareDate(Date.now(), task.intervalDays)
      this.saveTasks(tasks)

      // 自动记录
      this.addRecord({
        id: util.genId(),
        userPlantId: task.userPlantId,
        type: task.type,
        typeName: task.typeName,
        date: Date.now(),
        note: ''
      })
    }
    return task
  },

  updateTaskInterval(taskId, intervalDays) {
    const tasks = this.getTasks()
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      task.intervalDays = Math.max(1, intervalDays)
      task.nextDate = util.nextCareDate(task.lastDoneDate, task.intervalDays)
      this.saveTasks(tasks)
    }
    return task
  },

  toggleTask(taskId) {
    const tasks = this.getTasks()
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      task.enabled = !task.enabled
      this.saveTasks(tasks)
    }
    return task
  },

  removeTasksByPlant(plantId) {
    let tasks = this.getTasks()
    tasks = tasks.filter(t => t.userPlantId !== plantId)
    this.saveTasks(tasks)
  },

  // ========== 养护记录 ==========

  getRecords() {
    return wx.getStorageSync(this.KEYS.RECORDS) || []
  },

  getRecordsByPlant(plantId) {
    return this.getRecords().filter(r => r.userPlantId === plantId)
  },

  addRecord(record) {
    const records = this.getRecords()
    records.unshift(record) // 最新的排前面
    // 最多保留500条
    if (records.length > 500) records.length = 500
    wx.setStorageSync(this.KEYS.RECORDS, records)
    return record
  },

  removeRecordsByPlant(plantId) {
    let records = this.getRecords()
    records = records.filter(r => r.userPlantId !== plantId)
    wx.setStorageSync(this.KEYS.RECORDS, records)
  },

  // 删除单条记录
  deleteRecord(recordId) {
    let records = this.getRecords()
    records = records.filter(r => r.id !== recordId)
    wx.setStorageSync(this.KEYS.RECORDS, records)
  },

  // ========== 设置 ==========

  getSettings() {
    return wx.getStorageSync(this.KEYS.SETTINGS) || {
      reminderEnabled: true,
      reminderTime: '09:00',
      theme: 'green'
    }
  },

  saveSettings(settings) {
    wx.setStorageSync(this.KEYS.SETTINGS, settings)
  },

  // ========== 统计 ==========

  getStats() {
    const garden = this.getGarden()
    const tasks = this.getTasks()
    const records = this.getRecords()

    const categoryCount = {}
    garden.forEach(p => {
      categoryCount[p.category] = (categoryCount[p.category] || 0) + 1
    })

    const dueTasks = this.getDueTasks()

    return {
      totalPlants: garden.length,
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.enabled).length,
      dueToday: dueTasks.length,
      totalRecords: records.length,
      categories: categoryCount
    }
  }
}

module.exports = StorageManager
