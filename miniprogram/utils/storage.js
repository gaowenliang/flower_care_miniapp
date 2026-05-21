// utils/storage.js - 数据存储管理

const util = require('./util')
const cloudSync = require('./cloud-sync')

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
    SUBSCRIBE: 'subscribeState',
    RETRO: 'retroCards' // 补卡记录
  },

  // ========== 花园 ==========

  getGarden() {
    try {
      return wx.getStorageSync(this.KEYS.GARDEN) || []
    } catch (e) {
      console.error('读取花园数据失败:', e)
      return []
    }
  },

  saveGarden(garden) {
    try {
      wx.setStorageSync(this.KEYS.GARDEN, garden)
      cloudSync.syncItem('garden', garden)
    } catch (e) {
      console.error('保存花园数据失败:', e)
      wx.showToast({ title: '存储空间不足', icon: 'none' })
    }
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
    try {
      return wx.getStorageSync(this.KEYS.TASKS) || []
    } catch (e) {
      console.error('读取任务数据失败:', e)
      return []
    }
  },

  saveTasks(tasks) {
    try {
      wx.setStorageSync(this.KEYS.TASKS, tasks)
      cloudSync.syncItem('tasks', tasks)
    } catch (e) {
      console.error('保存任务数据失败:', e)
    }
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
      // 从 lastDoneDate 重新计算下次日期
      task.nextDate = util.nextCareDate(task.lastDoneDate, task.intervalDays)
      // 如果算出来的下次日期已过期，从当前时间重新算
      if (task.nextDate < Date.now()) {
        task.nextDate = util.nextCareDate(Date.now(), task.intervalDays)
      }
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
    try {
      return wx.getStorageSync(this.KEYS.RECORDS) || []
    } catch (e) {
      console.error('读取记录数据失败:', e)
      return []
    }
  },

  getRecordsByPlant(plantId) {
    return this.getRecords().filter(r => r.userPlantId === plantId)
  },

  addRecord(record) {
    const records = this.getRecords()
    records.unshift(record)
    if (records.length > 500) records.length = 500
    try {
      wx.setStorageSync(this.KEYS.RECORDS, records)
      cloudSync.syncItem('records', records)
    } catch (e) {
      console.error('保存记录失败:', e)
    }
    return record
  },

  removeRecordsByPlant(plantId) {
    let records = this.getRecords()
    records = records.filter(r => r.userPlantId !== plantId)
    try {
      wx.setStorageSync(this.KEYS.RECORDS, records)
    } catch (e) {
      console.error('删除记录失败:', e)
    }
  },

  deleteRecord(recordId) {
    let records = this.getRecords()
    records = records.filter(r => r.id !== recordId)
    try {
      wx.setStorageSync(this.KEYS.RECORDS, records)
    } catch (e) {
      console.error('删除记录失败:', e)
    }
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
    cloudSync.syncItem('settings', settings)
  },

  // ========== 统计 ==========

  getStats() {
    const garden = this.getGarden()
    const tasks = this.getTasks()
    const records = this.getRecords()

    const categoryCount = {}
    const familyCount = {}
    garden.forEach(p => {
      categoryCount[p.category] = (categoryCount[p.category] || 0) + 1
      if (p.family) {
        familyCount[p.family] = (familyCount[p.family] || 0) + 1
      }
    })

    const dueTasks = this.getDueTasks()

    return {
      totalPlants: garden.length,
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.enabled).length,
      dueToday: dueTasks.length,
      totalRecords: records.length,
      categories: categoryCount,
      families: familyCount
    }
  },

  // ========== 补卡 ==========

  /**
   * 获取本月补卡次数
   */
  getRetroCardsThisMonth() {
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`
    try {
      const all = wx.getStorageSync(this.KEYS.RETRO) || {}
      return all[monthKey] || []
    } catch (e) {
      return []
    }
  },

  /**
   * 补卡（给过去某天补充养护记录）
   * @param {number} dateTs 那天的时间戳（0点）
   * @param {string} userPlantId 植物ID
   * @returns {{success: boolean, reason?: string}}
   */
  retroCard(dateTs, userPlantId) {
    const MAX_RETRO_PER_MONTH = 3
    const now = new Date()
    const target = new Date(dateTs)

    // 只能补过去7天内的
    const daysDiff = Math.floor((now.getTime() - dateTs) / 86400000)
    if (daysDiff < 1) return { success: false, reason: '今天的不需要补卡' }
    if (daysDiff > 7) return { success: false, reason: '只能补7天内的记录' }

    // 检查本月补卡次数
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`
    let retroData = {}
    try { retroData = wx.getStorageSync(this.KEYS.RETRO) || {} } catch (e) {}
    const thisMonth = retroData[monthKey] || []
    if (thisMonth.length >= MAX_RETRO_PER_MONTH) {
      return { success: false, reason: `本月补卡次数已用完（${MAX_RETRO_PER_MONTH}次/月）` }
    }

    // 检查该天是否已有记录
    const dateStr = util.formatDate(dateTs)
    const existing = this.getRecords().find(r =>
      r.userPlantId === userPlantId && util.formatDate(r.date) === dateStr
    )
    if (existing) return { success: false, reason: '该天已有养护记录' }

    // 添加补卡记录
    const plant = this.getPlantById(userPlantId)
    this.addRecord({
      id: util.genId(),
      userPlantId,
      type: 'retro',
      typeName: '补卡记录',
      date: dateTs + 12 * 3600000, // 设为中午
      note: '补卡'
    })

    // 记录补卡次数
    thisMonth.push({ date: dateStr, plantId: userPlantId, time: Date.now() })
    retroData[monthKey] = thisMonth
    try { wx.setStorageSync(this.KEYS.RETRO, retroData); cloudSync.syncItem('retroCards', retroData) } catch (e) {}

    return { success: true }
  },

  /**
   * 获取补卡剩余次数
   */
  getRetroRemaining() {
    const used = this.getRetroCardsThisMonth().length
    return Math.max(0, 3 - used)
  }
}

module.exports = StorageManager
