// pages/plant-detail/plant-detail.js - 重构版（支持家庭模式）
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const plantsData = require('../../data/plants')
const imageUtil = require('../../utils/image')
const healthScore = require('../../utils/health-score')
const family = require('../../utils/family')
const classifyBehavior = require('./classify-behavior')

Page({
  behaviors: [classifyBehavior],

  data: {
    userPlant: null,
    plantInfo: null,
    tasks: [],
    records: [],
    activeTab: 'record',
    // 日历热力图
    calWeekdays: ['一', '二', '三', '四', '五', '六', '日'],
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    calMonthLabel: '',
    calWeeks: [],
    calSelectedDate: '',
    calSelectedRecords: [],
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
    // 到家日期
    showArrivalDateModal: false,
    arrivalDateInput: '',
    todayStr: '',
    arrivalDateText: ''
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
      this.loadFamilyRecords()
      this.loadSmartTips()
      setTimeout(() => this.setData({ loading: false }), 300)
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
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }

    let plantInfo = plantsData.plants.find(p => p.id === userPlant.plantId)
    if (!plantInfo) {
      plantInfo = { name: userPlant.name || '', latin: userPlant.latin || '', category: userPlant.family || userPlant.category || '', family: userPlant.family || '', genus: userPlant.genus || '' }
    } else {
      plantInfo = { ...plantInfo, family: userPlant.family || plantInfo.family || '', genus: userPlant.genus || plantInfo.genus || '', latin: userPlant.latin || plantInfo.latin || '' }
    }
    this.setData({ userPlant, plantInfo, arrivalDateText: this._formatArrivalDate(userPlant) })
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
    const records = await family.getRecords(this.data.userPlant._id, 200)
    const processedRecords = (records || []).map(r => ({
      ...r,
      id: r._id || r.id,
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

  // ========== 日历热力图 ==========
  buildCalendar() {
    const { calYear, calMonth, records, taskTypes, isFamilyMode } = this.data
    const y = calYear, m = calMonth
    const monthLabel = `${y}年${m + 1}月`

    // 动作 emoji 映射
    const typeMap = {}
    ;(taskTypes || []).forEach(t => { typeMap[t.id] = t.emoji })

    // 家庭成员颜色池
    const memberColorPool = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#C9B1FF']
    const memberColorMap = {}
    let colorIdx = 0

    // 按日期索引记录
    const dateMap = {}
    records.forEach((r, idx) => {
      const d = new Date(r.date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!dateMap[key]) dateMap[key] = []
      const emoji = typeMap[r.taskType || r.actionType] || '💧'
      const creatorId = r.creatorId || r.creatorOpenId || ''
      if (creatorId && !(creatorId in memberColorMap)) {
        memberColorMap[creatorId] = memberColorPool[colorIdx++ % memberColorPool.length]
      }
      dateMap[key].push({ ...r, emoji, idx, memberColor: memberColorMap[creatorId] || '#4CAF50' })
    })

    // 构建日历网格
    const firstDay = new Date(y, m, 1)
    let startWeekday = firstDay.getDay() // 0=周日
    startWeekday = startWeekday === 0 ? 6 : startWeekday - 1 // 转为周一=0
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`

    const weeks = []
    let week = []
    // 前置空格
    for (let i = 0; i < startWeekday; i++) week.push({ isEmpty: true })
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const key = `${y}-${m}-${d}`
      const dayRecords = dateMap[key] || []
      const isToday = key === todayStr
      const isFuture = new Date(y, m, d) > today
      const icons = [...new Set(dayRecords.map(r => r.emoji))]
      const memberColors = [...new Set(dayRecords.map(r => r.memberColor))]
      week.push({
        day: d, dateStr, isEmpty: false, isToday, isFuture,
        icons, memberColors, records: dayRecords
      })
      if (week.length === 7) { weeks.push(week); week = [] }
    }
    // 尾部填充
    if (week.length > 0) {
      while (week.length < 7) week.push({ isEmpty: true })
      weeks.push(week)
    }

    this.setData({ calMonthLabel: monthLabel, calWeeks: weeks })
  },

  prevMonth() {
    let { calYear, calMonth } = this.data
    calMonth--
    if (calMonth < 0) { calMonth = 11; calYear-- }
    this.setData({ calYear, calMonth, calSelectedRecords: [], calSelectedDate: '' })
    this.buildCalendar()
  },

  nextMonth() {
    let { calYear, calMonth } = this.data
    calMonth++
    if (calMonth > 11) { calMonth = 0; calYear++ }
    this.setData({ calYear, calMonth, calSelectedRecords: [], calSelectedDate: '' })
    this.buildCalendar()
  },

  toggleCellMenu(e) {
    const dateStr = e.currentTarget.dataset.date
    const { calWeeks, calSelectedDate } = this.data
    // 找到对应 cell
    let cell = null
    for (const week of calWeeks) {
      for (const c of week) {
        if (c.dateStr === dateStr) { cell = c; break }
      }
      if (cell) break
    }
    if (!cell || cell.isEmpty || !cell.records || cell.records.length === 0) return

    // 切换选中
    if (calSelectedDate === dateStr) {
      this.setData({ calSelectedRecords: [], calSelectedDate: '' })
    } else {
      this.setData({
        calSelectedDate: dateStr,
        calSelectedRecords: cell.records
      })
    }
  },

  async completeTask(e) {
    wx.vibrateShort({ type: 'light' })
    const taskId = e.currentTarget.dataset.id
    const task = this.data.tasks.find(t => (t.id || t._id) === taskId)

    // 施肥类型选择
    if (task && task.type === 'fertilize') {
      this.setData({ showFertilizeModal: true, pendingFertilizeTaskId: taskId })
      return
    }

    await this._doCompleteTask(taskId)
  },

  // 施肥快捷选择
  selectFertilizeType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ fertilizeInput: type === '自定义' ? '' : type })
  },

  onFertilizeInput(e) {
    this.setData({ fertilizeInput: e.detail.value })
  },

  async confirmFertilize() {
    const { pendingFertilizeTaskId, fertilizeInput } = this.data
    const note = fertilizeInput ? `施肥(${fertilizeInput})` : '施肥'
    this.setData({ showFertilizeModal: false, fertilizeInput: '' })

    await this._doCompleteTask(pendingFertilizeTaskId, note)
  },

  cancelFertilize() {
    this.setData({ showFertilizeModal: false, fertilizeInput: '', pendingFertilizeTaskId: '' })
  },

  async _doCompleteTask(taskId, note) {
    const task = this.data.tasks.find(t => (t.id || t._id) === taskId)

    if (this.data.isFamilyMode) {
      const result = await family.completeTask(taskId, note)
      if (!result.success) {
        wx.showToast({ title: result.error || '操作失败', icon: 'none' }); return
      }
      wx.showToast({ title: '完成啦~', icon: 'none' })
      await this.loadFamilyTasks()
      await this.loadFamilyRecords()
      return
    }

    // 个人模式
    storage.completeTask(taskId)
    // 追加带肥料类型的记录
    if (note) {
      const records = storage.getRecords()
      if (records.length > 0 && records[0].userPlantId === this.data.userPlant.id) {
        records[0].note = note
        try { wx.setStorageSync('careRecords', records) } catch (e) {}
      }
    }
    this.loadTasks()
    this.loadRecords()
    this.loadHealthScore()
    wx.showToast({ title: '完成啦~', icon: 'none' })
  },

  changeInterval(e) {
    const { taskId, delta } = e.currentTarget.dataset
    if (this.data.isFamilyMode) {
      const task = this.data.tasks.find(t => t.id === taskId || t._id === taskId)
      if (task) {
        const newInterval = Math.max(1, (task.intervalDays || 7) + parseInt(delta))
        family.updateTask(taskId, { intervalDays: newInterval }).then(() => this.loadFamilyTasks())
      }
      return
    }
    const tasks = storage.getTasksByPlant(this.data.userPlant.id)
    const task = tasks.find(t => t.id === taskId)
    if (task) {
      const newInterval = Math.max(1, task.intervalDays + parseInt(delta))
      storage.updateTaskInterval(taskId, newInterval)
    }
    this.loadTasks()
  },

  toggleTask(e) {
    const taskId = e.currentTarget.dataset.id
    if (this.data.isFamilyMode) {
      family.toggleTask(taskId).then(() => this.loadFamilyTasks())
      return
    }
    storage.toggleTask(taskId)
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

  async confirmAddTask() {
    const { newTaskType, newTaskInterval, userPlant, taskTypes } = this.data
    const taskType = taskTypes.find(t => t.id === newTaskType)

    if (this.data.isFamilyMode) {
      wx.showLoading({ title: '添加中...' })
      const result = await family.data('addTask', {
        task: {
          plantId: userPlant._id,
          type: newTaskType,
          typeName: taskType ? taskType.name : '养护',
          intervalDays: newTaskInterval
        }
      })
      wx.hideLoading()
      if (result.success) {
        this.setData({ showAddTask: false })
        await this.loadFamilyTasks()
        wx.showToast({ title: '任务已添加', icon: 'none' })
      } else {
        wx.showToast({ title: result.error || '添加失败', icon: 'none' })
      }
      return
    }

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

  markDead() {
    const isDead = this.data.userPlant.dead
    const action = isDead ? '复活' : '标记嘎了'
    const content = isDead ? `让${this.data.userPlant.nickname}复活？` : `确认${this.data.userPlant.nickname}嘎了？\n将停止所有养护提醒`

    wx.showModal({
      title: action, content, confirmColor: isDead ? '#4CAF50' : '#e53935',
      success: async (res) => {
        if (!res.confirm) return
        const updates = {}

        if (!isDead) {
          // 标记嘎了：记住原房间、移到💀天堂、停任务
          updates.dead = true
          updates.deadAt = Date.now()
          updates._prevLocation = this.data.userPlant.location
          updates.location = '💀 天堂'
        } else {
          // 复活：恢复原房间
          updates.dead = false
          updates.location = this.data.userPlant._prevLocation || '阳台'
          delete updates._prevLocation
        }

        // 更新本地显示
        const up = { ...this.data.userPlant, ...updates }
        this.setData({ userPlant: up })

        // 保存
        const plantId = this.data.userPlant._id || this.data.userPlant.id
        if (this.data.isFamilyMode && plantId) {
          try {
            await family.updatePlant(plantId, updates)
            // 家庭模式：停用/启用任务
            // isDead=操作前状态: false=正在标记死亡→停用enabled任务; true=正在复活→启用disabled任务
            const tasks = await family.getTasks(plantId)
            const togglePromises = (tasks || [])
              .filter(t => (!isDead && t.enabled) || (isDead && !t.enabled))
              .map(t => family.toggleTask(t._id || t.id))
            await Promise.all(togglePromises)
            await family.getPlants(true)
          } catch (e) {
            wx.showToast({ title: '保存失败', icon: 'none' }); return
          }
        } else {
          storage.updatePlant(this.data.userPlant.id, updates)
          // 个人模式：停用/启用任务
          const tasks = storage.getTasksByPlant(this.data.userPlant.id)
          tasks.forEach(t => {
            if (!isDead && t.enabled) storage.toggleTask(t.id)
            else if (isDead && !t.enabled) storage.toggleTask(t.id)
          })
        }

        wx.showToast({ title: isDead ? '复活了! 🌱' : '已标记 💀', icon: 'none' })
      }
    })
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
    const exifDate = require('../../utils/exif-date')
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: async (res) => {
        const files = res.tempFiles
        wx.showLoading({ title: '上传中...' })

        let earliestPhotoDate = Infinity

        for (let i = 0; i < files.length; i++) {
          const tempFile = files[i]
          const photoUrl = await imageUtil.uploadImage(tempFile.tempFilePath)
          if (!photoUrl) continue

          let photoDate = Date.now() + i
          const isCamera = tempFile.sourceType === 'camera' || (res.sourceType && res.sourceType === 'camera')
          if (!isCamera) {
            const exifTs = await exifDate.getExifDate(tempFile.tempFilePath)
            if (exifTs && exifTs > 0) photoDate = exifTs + i
          }
          if (photoDate < earliestPhotoDate) earliestPhotoDate = photoDate

          if (this.data.isFamilyMode) {
            await family.addRecord({
              userPlantId: this.data.userPlant._id,
              plantId: this.data.userPlant._id,
              type: 'photo',
              typeName: '拍照记录',
              note: '',
              photo: photoUrl,
              date: photoDate
            })
          } else {
            storage.addRecord({
              id: util.genId() + '_' + i,
              userPlantId: this.data.userPlant.id,
              type: 'photo',
              typeName: '拍照记录',
              date: photoDate,
              note: '',
              photo: photoUrl
            })
          }
        }

        wx.hideLoading()
        if (this.data.isFamilyMode) {
          await this.loadFamilyRecords()
          // 照片日期比 addedAt 更早，更新 addedAt
          if (earliestPhotoDate < Infinity && earliestPhotoDate < (this.data.userPlant.addedAt || Infinity)) {
            await family.updatePlant(this.data.userPlant._id, { addedAt: earliestPhotoDate })
          }
        } else {
          this.loadRecords()
          if (earliestPhotoDate < Infinity && earliestPhotoDate < (this.data.userPlant.addedAt || Infinity)) {
            storage.updatePlant(this.data.userPlant.id, { addedAt: earliestPhotoDate })
          }
        }
        wx.showToast({ title: `已记录${files.length}张 📷`, icon: 'none' })
      }
    })
  },

  addNote() {
    wx.showModal({
      title: '📝 记录一下',
      editable: true,
      placeholderText: '今天植物状态怎么样？',
      success: async (res) => {
        if (res.confirm && res.content) {
          if (this.data.isFamilyMode) {
            await family.addRecord({
              userPlantId: this.data.userPlant._id,
              plantId: this.data.userPlant._id,
              type: 'note',
              typeName: '备注',
              note: res.content
            })
            await this.loadFamilyRecords()
          } else {
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

  // 跳转截图导入
  goImportScreenshot() {
    wx.navigateTo({ url: '/pages/import-screenshot/import-screenshot' })
  },

  retroCard() {
    const MAX_RETRO_PER_MONTH = 3
    const isFamilyMode = this.data.isFamilyMode

    // 计算本月已用补卡次数
    let retroUsed = 0
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`
    if (isFamilyMode) {
      try {
        const retroData = wx.getStorageSync('_family_retro') || {}
        retroUsed = (retroData[monthKey] || []).length
      } catch (e) {}
    } else {
      retroUsed = MAX_RETRO_PER_MONTH - storage.getRetroRemaining()
    }
    const remaining = Math.max(0, MAX_RETRO_PER_MONTH - retroUsed)

    if (remaining <= 0) {
      wx.showToast({ title: '本月补卡次数已用完（3次/月）', icon: 'none', duration: 2500 })
      return
    }

    // 计算最近7天可补的日期
    const dates = []
    for (let i = 1; i <= 7; i++) {
      const d = new Date(now.getTime() - i * 86400000)
      d.setHours(0, 0, 0, 0)
      const dateStr = util.formatDate(d.getTime())
      const weekDay = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
      // 检查该天是否已有记录
      let existingRecords
      if (isFamilyMode) {
        existingRecords = family.getCachedRecords(this.data.userPlant._id || this.data.userPlant.id)
      } else {
        existingRecords = storage.getRecordsByPlant(this.data.userPlant.id)
      }
      const existing = existingRecords.find(r => util.formatDate(r.date) === dateStr)
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
          success: async (modalRes) => {
            if (modalRes.confirm) {
              if (isFamilyMode) {
                // 家庭模式补卡：加记录到云端
                try {
                  await family.addRecord({
                    plantId: this.data.userPlant._id || this.data.userPlant.id,
                    date: selected.ts + 12 * 3600000,
                    type: 'retro',
                    typeName: '补卡',
                    note: `补 ${selected.label} 养护记录`
                  })
                  // 记录补卡次数
                  let retroData = {}
                  try { retroData = wx.getStorageSync('_family_retro') || {} } catch (e) {}
                  if (!retroData[monthKey]) retroData[monthKey] = []
                  retroData[monthKey].push(selected.ts)
                  try { wx.setStorageSync('_family_retro', retroData) } catch (e) {}
                  wx.showToast({ title: '补卡成功 ✅', icon: 'none' })
                  this.loadFamilyRecords()
                } catch (e) {
                  wx.showToast({ title: '补卡失败', icon: 'none' })
                }
              } else {
                const result = storage.retroCard(selected.ts, this.data.userPlant.id)
                if (result.success) {
                  wx.showToast({ title: '补卡成功 ✅', icon: 'none' })
                  this.loadRecords()
                } else {
                  wx.showToast({ title: result.reason, icon: 'none' })
                }
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
        const photoUrl = await imageUtil.uploadSquareAvatar(res.tempFiles[0].tempFilePath)
        if (!photoUrl) {
          wx.showToast({ title: '图片上传失败', icon: 'none' })
          return
        }
        if (this.data.isFamilyMode) {
          await family.updatePlant(this.data.userPlant._id, { avatar: photoUrl })
          family.getPlants(true).catch(() => {})
        } else {
          storage.updatePlant(this.data.userPlant.id, { avatar: photoUrl })
        }
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
      success: async (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const nickname = res.content.trim()
          if (this.data.isFamilyMode) {
            await family.updatePlant(this.data.userPlant._id, { nickname })
          } else {
            storage.updatePlant(this.data.userPlant.id, { nickname })
          }
          this.setData({ 'userPlant.nickname': nickname })
          wx.showToast({ title: '已修改', icon: 'none' })
        }
      }
    })
  },

  // 编辑位置
  editLocation() {
    if (this.data.loading) return
    const rooms = ['阳台', '客厅', '卧室', '书房', '窗台', '花园']
    try {
      const custom = wx.getStorageSync('customRooms') || []
      custom.forEach(r => { if (!rooms.includes(r)) rooms.push(r) })
    } catch (e) {}
    this.setData({ showRoomModal: true, roomList: rooms, selectedRoom: this.data.userPlant.location || rooms[0] })
  },

  selectRoom(e) {
    this.setData({ selectedRoom: e.currentTarget.dataset.room })
  },

  onRoomInput(e) {
    this.setData({ customRoomInput: e.detail.value })
  },

  async confirmRoom() {
    const room = this.data.customRoomInput || this.data.selectedRoom
    if (!room) return
    this.setData({ showRoomModal: false, customRoomInput: '' })
    if (this.data.isFamilyMode) {
      await family.updatePlant(this.data.userPlant._id, { location: room })
    } else {
      storage.updatePlant(this.data.userPlant.id, { location: room })
    }
    this.setData({ 'userPlant.location': room })
    wx.showToast({ title: '已修改', icon: 'none' })
  },

  cancelRoom() {
    this.setData({ showRoomModal: false, customRoomInput: '' })
  },

  editPrice() {
    if (this.data.loading) return
    this.setData({
      showPriceModal: true,
      priceInput: this.data.userPlant.purchasePrice ? String(this.data.userPlant.purchasePrice) : '',
      sourceInput: this.data.userPlant.purchaseSource || ''
    })
  },

  onPriceInput(e) { this.setData({ priceInput: e.detail.value }) },
  onSourceInput(e) { this.setData({ sourceInput: e.detail.value }) },

  selectSource(e) {
    this.setData({ sourceInput: e.currentTarget.dataset.source })
  },

  async confirmPrice() {
    const price = Math.round((parseFloat(this.data.priceInput) || 0) * 100) / 100
    const source = this.data.sourceInput
    this.setData({ showPriceModal: false })
    const updates = { purchasePrice: price }
    if (source) updates.purchaseSource = source
    if (this.data.isFamilyMode) {
      await family.updatePlant(this.data.userPlant._id, updates)
    } else {
      storage.updatePlant(this.data.userPlant.id, updates)
    }
    this.setData({ 'userPlant.purchasePrice': price, 'userPlant.purchaseSource': source })
    wx.showToast({ title: price > 0 ? '已设置' : '已清除', icon: 'none' })
  },

  cancelPrice() {
    this.setData({ showPriceModal: false })
  },

  // ========== 到家日期 ==========
  _formatArrivalDate(plant) {
    const ts = plant.addedAt
    if (!ts) return '未设置'
    const d = new Date(ts)
    const days = Math.floor((Date.now() - ts) / 86400000)
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return `${dateStr}（${days}天）`
  },

  editArrivalDate() {
    const ts = this.data.userPlant.addedAt
    const d = ts ? new Date(ts) : new Date()
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    this.setData({ showArrivalDateModal: true, arrivalDateInput: dateStr, todayStr })
  },

  onArrivalDateChange(e) {
    this.setData({ arrivalDateInput: e.detail.value })
  },

  async confirmArrivalDate() {
    const dateStr = this.data.arrivalDateInput
    if (!dateStr) return
    const ts = new Date(dateStr + 'T00:00:00').getTime()
    if (isNaN(ts)) { wx.showToast({ title: '日期无效', icon: 'none' }); return }
    this.setData({ showArrivalDateModal: false })

    if (this.data.isFamilyMode) {
      await family.updatePlant(this.data.userPlant._id, { addedAt: ts })
    } else {
      const plant = storage.getGarden().find(p => p.id === this.data.userPlant.id)
      if (plant) { plant.addedAt = ts; storage.saveGarden() }
    }
    this.setData({
      'userPlant.addedAt': ts,
      arrivalDateText: this._formatArrivalDate({ addedAt: ts })
    })
    wx.showToast({ title: '已更新', icon: 'none' })
  },

  cancelArrivalDate() {
    this.setData({ showArrivalDateModal: false })
  },

  // ========== 删除记录 ==========
  toggleRecordMenu(e) {
    const idx = e.currentTarget.dataset.idx
    const records = this.data.records
    records.forEach((r, i) => { r.showMenu = (i === idx) ? !r.showMenu : false })
    this.setData({ records })
  },

  async deleteRecord(e) {
    const { id, idx } = e.currentTarget.dataset
    const record = this.data.records[idx]
    if (!record) return

    // 兼容家庭模式(_id)和个人模式(id)
    const recordId = id || record._id || record.id

    wx.showModal({
      title: '删除记录',
      content: `确定删除「${record.typeName}」记录？`,
      confirmColor: '#e53935',
      success: async (res) => {
        if (!res.confirm) return
        if (this.data.isFamilyMode) {
          const result = await family.deleteRecord(recordId)
          if (!result.success) {
            wx.showToast({ title: result.error || '删除失败', icon: 'none' })
            return
          }
        } else {
          storage.deleteRecord(recordId)
        }
        const records = this.data.records.filter((_, i) => i !== idx)
        this.setData({ records, calSelectedRecords: [] })
        this.buildCalendar()
        wx.showToast({ title: '已删除', icon: 'none' })
      }
    })
  },

  async _savePrice(price, source) {
    const updates = { purchasePrice: price }
    if (source) updates.purchaseSource = source
    if (this.data.isFamilyMode) {
      await family.updatePlant(this.data.userPlant._id, updates)
    } else {
      storage.updatePlant(this.data.userPlant.id, updates)
    }
    this.setData({ 'userPlant.purchasePrice': price, 'userPlant.purchaseSource': source })
    wx.showToast({ title: price > 0 ? '已设置' : '已清除', icon: 'none' })
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
  },

  // 阻止冒泡
  preventBubble() {}
})
