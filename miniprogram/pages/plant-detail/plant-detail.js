// pages/plant-detail/plant-detail.js - 重构版
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const plantsData = require('../../data/plants')

Page({
  data: {
    userPlant: null,
    plantInfo: null,
    tasks: [],
    records: [],
    activeTab: 'care',
    showAddTask: false,
    newTaskType: 'water',
    newTaskInterval: 7,
    taskTypes: plantsData.taskTypes,
    smartTips: [],
    tipWeather: '',
    tipDate: ''
  },

  onLoad(options) {
    const id = options.id
    const userPlant = storage.getPlantById(id)

    if (!userPlant) {
      wx.showToast({ title: '植物不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }

    const plantInfo = plantsData.plants.find(p => p.id === userPlant.plantId)
    this.setData({ userPlant, plantInfo })
    this.loadTasks()
    this.loadRecords()
    this.loadSmartTips()
  },

  loadTasks() {
    const tasks = storage.getTasksByPlant(this.data.userPlant.id)
    tasks.forEach(task => {
      task.daysUntil = util.daysUntilNext(task.nextDate)
      task.statusText = task.daysUntil <= 0 ? '该养护了!' : `${task.daysUntil}天后`
      task.isOverdue = task.daysUntil <= 0
    })
    this.setData({ tasks })
  },

  loadRecords() {
    const records = storage.getRecordsByPlant(this.data.userPlant.id).slice(0, 20)
    records.forEach(r => {
      r.dateText = util.formatDate(r.date)
      r.timeAgo = util.timeAgo(r.date)
    })
    this.setData({ records })
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
  },

  completeTask(e) {
    storage.completeTask(e.currentTarget.dataset.id)
    this.loadTasks()
    this.loadRecords()
    wx.showToast({ title: '完成啦~ 🎉', icon: 'none' })
  },

  changeInterval(e) {
    const { taskId, delta } = e.currentTarget.dataset
    const tasks = storage.getTasksByPlant(this.data.userPlant.id)
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      const newInterval = Math.max(1, task.intervalDays + parseInt(delta))
      storage.updateTaskInterval(taskId, newInterval)
    }
    this.loadTasks()
  },

  toggleTask(e) {
    storage.toggleTask(e.currentTarget.dataset.id)
    this.loadTasks()
  },

  // 添加新养护任务
  showAddTaskModal() {
    this.setData({ showAddTask: true })
  },

  hideAddTaskModal() {
    this.setData({ showAddTask: false })
  },

  selectTaskType(e) {
    this.setData({ newTaskType: e.currentTarget.dataset.type })
    // 根据类型设置默认间隔
    const defaults = { water: 7, fertilize: 30, prune: 60, repot: 180, spray: 14 }
    this.setData({ newTaskInterval: defaults[this.data.newTaskType] || 7 })
  },

  onIntervalInput(e) {
    this.setData({ newTaskInterval: parseInt(e.detail.value) || 1 })
  },

  confirmAddTask() {
    const { newTaskType, newTaskInterval, userPlant, taskTypes } = this.data
    const taskType = taskTypes.find(t => t.id === newTaskType)

    storage.addTask({
      id: util.genId(),
      userPlantId: userPlant.id,
      type: newTaskType,
      typeName: taskType ? taskType.name : '养护',
      intervalDays: newTaskInterval,
      nextDate: util.nextCareDate(Date.now(), newTaskInterval),
      lastDoneDate: Date.now(),
      enabled: true
    })

    this.setData({ showAddTask: false })
    this.loadTasks()
    wx.showToast({ title: '任务已添加', icon: 'none' })
  },

  deletePlant() {
    wx.showModal({
      title: '确认删除',
      content: `确定要把 ${this.data.userPlant.nickname} 从花园移除吗？所有养护记录也将删除。`,
      confirmColor: '#FF5252',
      success: (res) => {
        if (res.confirm) {
          storage.removePlant(this.data.userPlant.id)
          wx.showToast({ title: '已移除', icon: 'none' })
          setTimeout(() => wx.navigateBack(), 1000)
        }
      }
    })
  },

  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: (res) => {
        storage.addRecord({
          id: util.genId(),
          userPlantId: this.data.userPlant.id,
          type: 'photo',
          typeName: '拍照记录',
          date: Date.now(),
          note: '',
          photo: res.tempFiles[0].tempFilePath
        })
        this.loadRecords()
        wx.showToast({ title: '已记录 📷', icon: 'none' })
      }
    })
  },

  addNote() {
    wx.showModal({
      title: '📝 记录一下',
      editable: true,
      placeholderText: '今天植物状态怎么样？',
      success: (res) => {
        if (res.confirm && res.content) {
          storage.addRecord({
            id: util.genId(),
            userPlantId: this.data.userPlant.id,
            type: 'note',
            typeName: '备注',
            date: Date.now(),
            note: res.content
          })
          this.loadRecords()
        }
      }
    })
  },

  // 跳转成长日记
  goJournal() {
    wx.navigateTo({ url: `/pages/plant-journal/plant-journal?id=${this.data.userPlant.id}` })
  },

  // 修改植物头像
  changeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const photo = res.tempFiles[0].tempFilePath
        storage.updatePlant(this.data.userPlant.id, { avatar: photo })
        this.setData({ 'userPlant.avatar': photo })
        wx.showToast({ title: '头像已更新', icon: 'none' })
      }
    })
  },

  // 智能贴士（每日刷新）
  async loadSmartTips() {
    const smartTips = require('../../utils/smart-tips')
    try {
      const result = await smartTips.generateSmartTips(
        this.data.plantInfo,
        this.data.userPlant.location,
        '' // 城市编码，可从设置中读取
      )
      this.setData({
        smartTips: result.tips,
        tipWeather: result.weather,
        tipDate: result.date
      })
    } catch (e) {
      // 降级用原始贴士
      this.setData({
        smartTips: this.data.plantInfo ? this.data.plantInfo.tips : [],
        tipWeather: '',
        tipDate: ''
      })
    }
  },

  onShareAppMessage() {
    return {
      title: `我的${this.data.userPlant.nickname}长得真好！`,
      path: '/pages/index/index'
    }
  }
})
