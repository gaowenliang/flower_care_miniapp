// pages/plant-detail/plant-detail.js - 重构版（支持家庭模式）
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const plantsData = require('../../data/plants')
const imageUtil = require('../../utils/image')
const healthScore = require('../../utils/health-score')
const family = require('../../utils/family')

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
    tipDate: '',
    loading: true,
    // 家庭模式
    isFamilyMode: false,
    isAdoptedByMe: false,
    adopterNames: []
  },

  onLoad(options) {
    const id = options.id
    const isFamilyMode = family.isInFamily()
    this.setData({ isFamilyMode })

    if (isFamilyMode) {
      const userPlant = family.getPlantById(id)
      if (!userPlant) {
        wx.showToast({ title: '植物不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1000)
        return
      }
      const plantInfo = plantsData.plants.find(p => p.id === userPlant.plantId)
      userPlant.id = userPlant._id || id
      this.setData({
        userPlant, plantInfo,
        isAdoptedByMe: family.isAdoptedByMe(id),
        adopterNames: family.getAdopterNames(userPlant)
      })
      this.loadFamilyTasks()
      this.loadFamilyRecords()
      this.loadSmartTips()
      setTimeout(() => this.setData({ loading: false }), 300)
      return
    }

    // 个人模式
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
    setTimeout(() => this.setData({ loading: false }), 300)
    this.loadHealthScore()
  },

  // ========== 认养 ==========

  async toggleAdopt() {
    const result = await family.toggleAdopt(this.data.userPlant._id)
    if (result.success) {
      const adopted = result.adopted
      this.setData({ isAdoptedByMe: adopted })
      // 刷新认养者列表
      const plant = family.getPlantById(this.data.userPlant._id)
      if (plant) {
        this.setData({ adopterNames: family.getAdopterNames(plant) })
      }
      wx.showToast({ title: adopted ? '已认养 💚' : '已取消认养', icon: 'none' })
    } else {
      wx.showToast({ title: result.error || '操作失败', icon: 'none' })
    }
  },

  // ========== 家庭模式数据加载 ==========

  async loadFamilyTasks() {
    const tasks = await family.getTasks(this.data.userPlant._id)
    const processedTasks = (tasks || []).map(task => ({
      ...task,
      id: task._id,
      daysUntil: task.nextDate ? Math.ceil((task.nextDate - Date.now()) / 86400000) : 0,
      statusText: task.nextDate && task.nextDate <= Date.now() ? '该养护了!' : `${Math.ceil((task.nextDate - Date.now()) / 86400000)}天后`,
      isOverdue: task.nextDate && task.nextDate <= Date.now()
    }))
    this.setData({ tasks: processedTasks })
  },

  async loadFamilyRecords() {
    const records = await family.getRecords(this.data.userPlant._id, 20)
    const processedRecords = (records || []).map(r => ({
      ...r,
      dateText: util.formatDate(r.date),
      timeAgo: util.timeAgo(r.date)
    }))
    this.setData({ records: processedRecords })
  },

  // ========== 个人模式数据加载 ==========

  loadTasks() {
    if (this.data.isFamilyMode) return
    const tasks = storage.getTasksByPlant(this.data.userPlant.id)
    tasks.forEach(task => {
      task.daysUntil = util.daysUntilNext(task.nextDate)
      task.statusText = task.daysUntil <= 0 ? '该养护了!' : `${task.daysUntil}天后`
      task.isOverdue = task.daysUntil <= 0
    })
    this.setData({ tasks })
  },

  loadRecords() {
    if (this.data.isFamilyMode) return
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

  async completeTask(e) {
    wx.vibrateShort({ type: 'light' })
    const taskId = e.currentTarget.dataset.id

    if (this.data.isFamilyMode) {
      const result = await family.completeTask(taskId)
      if (result.success) {
        wx.showToast({ title: '完成啦~', icon: 'none' })
        await this.loadFamilyTasks()
        await this.loadFamilyRecords()
      } else {
        wx.showToast({ title: result.error || '操作失败', icon: 'none' })
      }
      return
    }

    storage.completeTask(taskId)
    this.loadTasks()
    this.loadRecords()
    this.loadHealthScore()
    wx.showToast({ title: '完成啦~', icon: 'none' })
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
      content: `确定要把 ${this.data.userPlant.nickname} 从花园移除吗？`,
      confirmColor: '#2E7D32',
      success: async (res) => {
        if (res.confirm) {
          if (this.data.isFamilyMode) {
            wx.showLoading({ title: '删除中...' })
            const result = await family.removePlant(this.data.userPlant._id)
            wx.hideLoading()
            if (result.success) {
              wx.showToast({ title: '已删除', icon: 'none' })
              setTimeout(() => wx.navigateBack(), 1000)
            } else {
              wx.showToast({ title: result.error || '删除失败', icon: 'none' })
            }
            return
          }

          // 个人模式
          const backup = {
            plant: JSON.parse(JSON.stringify(this.data.userPlant)),
            tasks: storage.getTasksByPlant(this.data.userPlant.id),
            records: storage.getRecordsByPlant(this.data.userPlant.id)
          }
          storage.removePlant(this.data.userPlant.id)

          const pages = getCurrentPages()
          const prevPage = pages.length >= 2 ? pages[pages.length - 2] : null
          if (prevPage && prevPage.onShow) prevPage.onShow()
          wx.showToast({ title: '已删除', icon: 'none', duration: 3000 })

          this._deleteBackup = backup
          setTimeout(() => { this._deleteBackup = null }, 5000)

          setTimeout(() => wx.navigateBack(), 1000)
        }
      }
    })
  },

  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: async (res) => {
        const photoUrl = await imageUtil.uploadImage(res.tempFiles[0].tempFilePath)
        storage.addRecord({
          id: util.genId(),
          userPlantId: this.data.userPlant.id,
          type: 'photo',
          typeName: '拍照记录',
          date: Date.now(),
          note: '',
          photo: photoUrl
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

  goDiagnose() {
    wx.navigateTo({ url: '/pages/diagnose/diagnose' })
  },

  retroCard() {
    const remaining = storage.getRetroRemaining()
    if (remaining <= 0) {
      wx.showToast({ title: '本月补卡次数已用完（3次/月）', icon: 'none', duration: 2500 })
      return
    }

    // 计算最近7天可补的日期
    const dates = []
    const now = new Date()
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now.getTime() - i * 86400000)
      d.setHours(0, 0, 0, 0)
      const dateStr = util.formatDate(d.getTime())
      const weekDay = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
      // 检查该天是否已有记录
      const existing = storage.getRecordsByPlant(this.data.userPlant.id)
        .find(r => util.formatDate(r.date) === dateStr)
      if (!existing) {
        dates.push({
          ts: d.getTime(),
          label: `${d.getMonth() + 1}/${d.getDate()} 周${weekDay}`,
          daysAgo: i
        })
      }
    }

    if (dates.length === 0) {
      wx.showToast({ title: '最近7天都有记录了~', icon: 'none' })
      return
    }

    wx.showActionSheet({
      alertText: `本月剩余 ${remaining} 次补卡`,
      itemList: dates.map(d => d.label + ` (${d.daysAgo}天前)`),
      success: (res) => {
        const selected = dates[res.tapIndex]
        wx.showModal({
          title: '确认补卡',
          content: `为 ${this.data.userPlant.nickname} 补 ${selected.label} 的养护记录？`,
          success: (modalRes) => {
            if (modalRes.confirm) {
              const result = storage.retroCard(selected.ts, this.data.userPlant.id)
              if (result.success) {
                wx.showToast({ title: '补卡成功 ✅', icon: 'none' })
                this.loadRecords()
              } else {
                wx.showToast({ title: result.reason, icon: 'none' })
              }
            }
          }
        })
      }
    })
  },

  // 修改植物头像
  changeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: async (res) => {
        const photoUrl = await imageUtil.uploadImage(res.tempFiles[0].tempFilePath)
        storage.updatePlant(this.data.userPlant.id, { avatar: photoUrl })
        this.setData({ 'userPlant.avatar': photoUrl })
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

  // 编辑昵称
  editNickname() {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: this.data.userPlant.nickname,
      success: (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const nickname = res.content.trim()
          storage.updatePlant(this.data.userPlant.id, { nickname })
          this.setData({ 'userPlant.nickname': nickname })
          wx.showToast({ title: '已修改', icon: 'none' })
        }
      }
    })
  },

  // 编辑位置
  editLocation() {
    const rooms = ['阳台', '客厅', '卧室', '书房', '窗台', '花园']
    // 加上自定义房间
    try {
      const custom = wx.getStorageSync('customRooms') || []
      custom.forEach(r => { if (!rooms.includes(r)) rooms.push(r) })
    } catch (e) {}
    wx.showActionSheet({
      itemList: rooms,
      success: (res) => {
        const room = rooms[res.tapIndex]
        storage.updatePlant(this.data.userPlant.id, { location: room })
        this.setData({ 'userPlant.location': room })
        wx.showToast({ title: '已修改', icon: 'none' })
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

  // 图片加载失败兜底
  onAvatarError() {
    this.setData({ 'userPlant.avatar': '' })
  }
})
