// pages/plant-detail/plant-detail.js - 重构版（支持家庭模式）
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const plantsData = require('../../data/plants')
const imageUtil = require('../../utils/image')
const healthScore = require('../../utils/health-score')
const family = require('../../utils/family')
const classifyBehavior = require('./classify-behavior')
const taskManagerBehavior = require('./task-manager-behavior')
const plantEditorBehavior = require('./plant-editor-behavior')
const recordManagerBehavior = require('./record-manager-behavior')

function _timer(page, fn, delay) {
  const id = setTimeout(fn, delay)
  page.data._timers.push(id)
  return id
}

Page({
  behaviors: [classifyBehavior, taskManagerBehavior, plantEditorBehavior, recordManagerBehavior],

  data: {
    userPlant: null,
    plantInfo: null,
    tasks: [],
    records: [],
    activeTab: 'record',
    // 养护记录时间线
    recordTimeline: [],
    showAddTask: false,
    newTaskType: 'water',
    newTaskInterval: 7,
    taskTypes: plantsData.taskTypes,
    smartTips: [],
    tipWeather: '',
    tipDate: '',
    loading: true,
    // 家庭模式
    isFamilyMode: false,
    isAdoptedByMe: false,
    adopterNames: [],
    // 施肥类型弹窗
    showFertilizeModal: false,
    pendingFertilizeTaskId: '',
    fertilizeInput: '',
    fertilizeTypes: ['通用肥', '氮肥', '磷肥', '钾肥', '有机肥', '缓释肥', '液肥', '复合肥', '自定义'],
    // 房间弹窗
    showRoomModal: false,
    roomList: [],
    selectedRoom: '',
    customRoomInput: '',
    // 价格弹窗
    showPriceModal: false,
    priceInput: '',
    sourceInput: '',
    // 补浇水
    showRetroWater: false,
    retroWaterDate: '',
    retroWaterDates: [],
    retroWaterCustomDate: '',
    // 到家日期
    showArrivalDateModal: false,
    arrivalDateInput: '',
    todayStr: '',
    arrivalDateText: '',
    // timer清理
    _timers: []
  },

  onLoad(options) {
    const id = options.id
    const isFamilyMode = family.isInFamily()
    this.setData({ isFamilyMode })

    if (isFamilyMode) {
      const userPlant = family.getPlantById(id)
      if (!userPlant) {
        wx.showToast({ title: '植物不存在', icon: 'none' })
        _timer(this, () => wx.navigateBack(), 1000)
        return
      }
      let plantInfo = plantsData.plants.find(p => p.id === userPlant.plantId)
      // 自定义植物或数据库无匹配时，用云端数据构造
      if (!plantInfo) {
        plantInfo = {
          name: userPlant.name || '',
          latin: userPlant.latin || '',
          category: userPlant.family || userPlant.category || '',
          family: userPlant.family || '',
          genus: userPlant.genus || ''
        }
      } else {
        // 合并云端最新的科属信息
        plantInfo = { ...plantInfo, family: userPlant.family || plantInfo.family || '', genus: userPlant.genus || plantInfo.genus || '', latin: userPlant.latin || plantInfo.latin || '' }
      }
      userPlant.id = userPlant._id || id
      this.setData({
        userPlant, plantInfo,
        isAdoptedByMe: family.isAdoptedByMe(id),
        adopterNames: family.getAdopterNames(userPlant)
      })
      this.loadFamilyTasks()
      this.loadFamilyRecords(true)  // noWait：先走缓存，后台刷
      this.loadSmartTips()
      _timer(this, () => this.setData({ loading: false }), 300)
      this.loadHealthScore()
      // 后台刷新最新数据（看别人改的头像等）
      family.getPlants(true).then(plants => {
        const fresh = plants.find(p => p._id === id)
        if (fresh) {
          fresh.id = fresh._id || id
          // 同步更新 plantInfo
          let pi = { ...this.data.plantInfo }
          pi = { ...pi, family: fresh.family || pi.family || '', genus: fresh.genus || pi.genus || '', latin: fresh.latin || pi.latin || '', category: fresh.family || pi.category || '' }
          this.setData({
            userPlant: fresh,
            plantInfo: pi,
            adopterNames: family.getAdopterNames(fresh)
          })
          this.loadHealthScore()
        }
      }).catch(() => {})
      return
    }

    // 个人模式
    const userPlant = storage.getPlantById(id)

    if (!userPlant) {
      wx.showToast({ title: '植物不存在', icon: 'none' })
      _timer(this, () => wx.navigateBack(), 1000)
      return
    }

    let plantInfo = plantsData.plants.find(p => p.id === userPlant.plantId)
    if (!plantInfo) {
      plantInfo = { name: userPlant.name || '', latin: userPlant.latin || '', category: userPlant.family || userPlant.category || '', family: userPlant.family || '', genus: userPlant.genus || '' }
    } else {
      plantInfo = { ...plantInfo, family: userPlant.family || plantInfo.family || '', genus: userPlant.genus || plantInfo.genus || '', latin: userPlant.latin || plantInfo.latin || '' }
    }
    this.setData({ userPlant, plantInfo, arrivalDateText: this._formatArrivalDate(userPlant), todayStr: this._getTodayStr(), retroWaterDates: this._buildRetroWaterDates() })
    this.loadTasks()
    this.loadRecords()
    this.loadSmartTips()
    _timer(this, () => this.setData({ loading: false }), 300)
    this.loadHealthScore()
  },

  // ========== 家庭模式数据加载 ==========

  async loadFamilyTasks() {
    const tasks = await family.getTasks(this.data.userPlant._id)
    const processedTasks = (tasks || []).map(task => {
      const daysUntil = task.nextDate ? Math.ceil((task.nextDate - Date.now()) / 86400000) : 0
      const isOverdue = task.nextDate && task.nextDate <= Date.now()
      const overdueDays = isOverdue ? Math.floor((Date.now() - task.nextDate) / 86400000) : 0
      let statusText
      if (isOverdue) {
        statusText = overdueDays === 0 ? '今天该养护了!' : `已逾期${overdueDays}天`
      } else {
        statusText = daysUntil === 0 ? '今天该养护了' : `${daysUntil}天后`
      }
      return {
        ...task,
        id: task._id,
        daysUntil,
        isOverdue,
        overdueDays,
        statusText
      }
    })
    this.setData({ tasks: processedTasks })
  },

  async loadFamilyRecords(noWait) {
    // noWait: 页面初始加载时先走缓存立即渲染，后台静默刷新
    // 操作后刷新（completeTask/拍照）不用 noWait，等云端最新数据
    if (noWait) {
      const cachedRecords = family.getCachedRecords(this.data.userPlant._id) || []
      if (cachedRecords.length > 0) {
        const processed = cachedRecords.map(r => ({
          ...r, id: r._id || r.id,
          dateText: util.formatDate(r.date),
          timeAgo: util.timeAgo(r.date)
        }))
        this.setData({ records: processed })
        this.buildCalendar()
      }
      // 后台静默刷新
      family.getRecords(this.data.userPlant._id, 500, true).then(freshRecords => {
        const fresh = (freshRecords || []).map(r => ({
          ...r, id: r._id || r.id,
          dateText: util.formatDate(r.date),
          timeAgo: util.timeAgo(r.date)
        }))
        this.setData({ records: fresh })
        this.buildCalendar()
      }).catch(() => {})
      return
    }
    const records = await family.getRecords(this.data.userPlant._id, 500, true)
    const processedRecords = (records || []).map(r => ({
      ...r,
      id: r._id || r.id,
      dateText: util.formatDate(r.date),
      timeAgo: util.timeAgo(r.date)
    }))
    this.setData({ records: processedRecords })
    this.buildCalendar()
  },

  // ========== 个人模式数据加载 ==========

  loadTasks() {
    if (this.data.isFamilyMode) return
    const tasks = storage.getTasksByPlant(this.data.userPlant.id)
    tasks.forEach(task => {
      task.daysUntil = util.daysUntilNext(task.nextDate)
      const overdueDays = -task.daysUntil
      task.isOverdue = task.daysUntil <= 0
      if (task.isOverdue) {
        task.overdueDays = overdueDays
        task.statusText = overdueDays === 0 ? '今天该养护了!' : `已逾期${overdueDays}天`
      } else {
        task.overdueDays = 0
        task.statusText = task.daysUntil === 0 ? '今天该养护了' : `${task.daysUntil}天后`
      }
    })
    this.setData({ tasks })
  },

  loadRecords() {
    if (this.data.isFamilyMode) return
    const records = storage.getRecordsByPlant(this.data.userPlant.id).slice(0, 200)
    records.forEach(r => {
      r.dateText = util.formatDate(r.date)
      r.timeAgo = util.timeAgo(r.date)
    })
    this.setData({ records })
    this.buildCalendar()
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
    if (e.currentTarget.dataset.tab === 'record') this.buildCalendar()
  },

  // ========== 养护记录时间线（胶囊） ==========
  buildCalendar() {
    const { records, taskTypes } = this.data
    const typeEmojis = {}
    ;(taskTypes || []).forEach(t => { typeEmojis[t.id] = t.emoji })
    const timeline = util.buildRecordTimeline(records, typeEmojis)
    this.setData({ recordTimeline: timeline })
  },

  // 智能贴士（每日刷新）
  async loadSmartTips() {
    const smartTips = require('../../utils/smart-tips')
    try {
      const result = await smartTips.generateSmartTips(
        this.data.plantInfo,
        this.data.userPlant.location,
        ''
      )
      this.setData({
        smartTips: result.tips,
        tipWeather: result.weather,
        tipDate: result.date
      })
    } catch (e) {
      this.setData({
        smartTips: this.data.plantInfo ? this.data.plantInfo.tips : [],
        tipWeather: '',
        tipDate: ''
      })
    }
  },

  loadHealthScore() {
    const result = healthScore.calculateHealthScore(this.data.userPlant)
    const level = healthScore.getHealthLevel(result.score)
    this.setData({ healthScore: result.score, healthLevel: level })
  },

  // 导出报告
  shareReport() {
    const exportUtil = require('../../utils/export')
    wx.showActionSheet({
      itemList: ['复制养护报告', '分享给好友'],
      success: (res) => {
        if (res.tapIndex === 0) {
          exportUtil.copyReport(this.data.userPlant.id)
        } else if (res.tapIndex === 1) {
          wx.showShareMenu({ withShareTicket: true })
        }
      }
    })
  },

  onShareAppMessage() {
    const plant = this.data.userPlant
    const days = Math.floor((Date.now() - plant.addedAt) / 86400000)
    return {
      title: `我的${plant.nickname}已经养了${days}天，状态不错！`,
      path: '/pages/index/index'
    }
  },

  // 阻止冒泡
  preventBubble() {},

  onUnload() {
    this.data._timers.forEach(id => clearTimeout(id))
    this.data._timers = []
  }
})
