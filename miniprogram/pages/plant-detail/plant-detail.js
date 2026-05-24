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
    adopterNames: [],
    // 分类相关
    showClassifyAction: false,
    showClassifySearch: false,
    classifySearchKey: '',
    classifySearchResults: [],
    showClassifyResult: false,
    classifyResult: null
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
      this.loadHealthScore()
      // 后台刷新最新数据（看别人改的头像等）
      family.getPlants(true).then(plants => {
        const fresh = plants.find(p => p._id === id)
        if (fresh) {
          fresh.id = fresh._id || id
          this.setData({
            userPlant: fresh,
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
    const task = this.data.tasks.find(t => (t.id || t._id) === taskId)

    // 先完成，再问费用（不阻塞完成操作）
    const doComplete = async (cost) => {
      cost = Math.round((cost || 0) * 100) / 100
      if (cost < 0) { wx.showToast({ title: '花费不能为负数', icon: 'none' }); return }

      if (this.data.isFamilyMode) {
        const result = await family.completeTask(taskId)
        if (!result.success) {
          wx.showToast({ title: result.error || '操作失败', icon: 'none' }); return
        }
        if (cost > 0) {
          await family.addRecord({
            plantId: this.data.userPlant._id,
            type: 'cost',
            typeName: '维护花费',
            note: `${task ? task.typeName : '养护'} · ¥${cost.toFixed(2)}`,
            cost
          })
        }
        wx.showToast({ title: cost > 0 ? `完成，花费 ¥${cost.toFixed(2)}` : '完成啦~', icon: 'none' })
        await this.loadFamilyTasks()
        await this.loadFamilyRecords()
        return
      }

      // 个人模式
      storage.completeTask(taskId)
      if (cost > 0) {
        storage.addRecord({
          id: util.genId(),
          userPlantId: this.data.userPlant.id,
          type: 'cost',
          typeName: '维护花费',
          date: Date.now(),
          note: `${task ? task.typeName : '养护'} · ¥${cost.toFixed(2)}`,
          cost
        })
      }
      this.loadTasks()
      this.loadRecords()
      this.loadHealthScore()
      wx.showToast({ title: cost > 0 ? `完成，花费 ¥${cost.toFixed(2)}` : '完成啦~', icon: 'none' })
    }

    wx.showModal({
      title: `完成「${task ? task.typeName : '养护'}」`,
      editable: true,
      placeholderText: '花费金额（元），不填则跳过',
      content: '',
      success: async (res) => {
        if (res.confirm) {
          await doComplete(parseFloat(res.content) || 0)
        } else {
          // 取消 = 不记费用，但仍然完成
          await doComplete(0)
        }
      }
    })
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
        if (!photoUrl) {
          wx.showToast({ title: '图片上传失败', icon: 'none' }); return
        }
        if (this.data.isFamilyMode) {
          await family.addRecord({
            userPlantId: this.data.userPlant._id,
            plantId: this.data.userPlant._id,
            type: 'photo',
            typeName: '拍照记录',
            note: '',
            photo: photoUrl
          })
          await this.loadFamilyRecords()
        } else {
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
        }
        wx.showToast({ title: '已记录 📷', icon: 'none' })
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
    const rooms = ['阳台', '客厅', '卧室', '书房', '窗台', '花园']
    try {
      const custom = wx.getStorageSync('customRooms') || []
      custom.forEach(r => { if (!rooms.includes(r)) rooms.push(r) })
    } catch (e) {}
    wx.showActionSheet({
      itemList: rooms,
      success: async (res) => {
        const room = rooms[res.tapIndex]
        if (this.data.isFamilyMode) {
          await family.updatePlant(this.data.userPlant._id, { location: room })
        } else {
          storage.updatePlant(this.data.userPlant.id, { location: room })
        }
        this.setData({ 'userPlant.location': room })
        wx.showToast({ title: '已修改', icon: 'none' })
      }
    })
  },

  editPrice() {
    const current = this.data.userPlant.purchasePrice || ''
    const currentSource = this.data.userPlant.purchaseSource || ''
    wx.showModal({
      title: '💰 购入信息',
      editable: true,
      placeholderText: '输入价格，如 29.9',
      content: current ? String(current) : '',
      success: async (res) => {
        if (!res.confirm) return
        const price = Math.round((parseFloat(res.content) || 0) * 100) / 100
        if (price < 0) { wx.showToast({ title: '价格不能为负数', icon: 'none' }); return }
        // 价格设好后，问渠道
        if (price > 0 && !currentSource) {
          wx.showActionSheet({
            itemList: ['花店', '网购', '花市', '亲友赠', '其他'],
            success: async (sheetRes) => {
              const sources = ['花店', '网购', '花市', '亲友赠', '其他']
              const source = sources[sheetRes.tapIndex]
              await this._savePrice(price, source)
            },
            fail: async () => {
              await this._savePrice(price, '')
            }
          })
        } else {
          await this._savePrice(price, currentSource)
        }
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

  // ========== 分类识别功能 ==========

  showClassifyMenu() {
    this.setData({ showClassifyAction: true })
  },
  hideClassifyMenu() {
    this.setData({ showClassifyAction: false })
  },

  // 1. 填写分类 - 搜索科
  openClassifySearch() {
    this.setData({ showClassifyAction: false, showClassifySearch: true, classifySearchKey: '', classifySearchResults: [] })
  },
  hideClassifySearch() {
    this.setData({ showClassifySearch: false })
  },
  onClassifySearchInput(e) {
    const key = e.detail.value.trim()
    this.setData({ classifySearchKey: key })
    if (!key) { this.setData({ classifySearchResults: [] }); return }
    // 搜索植物数据库中的科
    const allPlants = require('../../data/plants').plants
    const families = new Set()
    allPlants.forEach(p => {
      if (p.family && (p.family.includes(key) || p.name.includes(key) || (p.latin || '').toLowerCase().includes(key.toLowerCase()))) {
        families.add(p.family)
      }
    })
    // 也直接匹配输入
    if (key.endsWith('科')) families.add(key)
    this.setData({ classifySearchResults: [...families].slice(0, 10) })
  },
  selectFamily(e) {
    const f = e.currentTarget.dataset.family
    this._updatePlantClassify({ family: f })
    this.setData({ showClassifySearch: false })
  },
  confirmClassifyInput() {
    const key = this.data.classifySearchKey
    if (!key) return
    this._updatePlantClassify({ family: key })
    this.setData({ showClassifySearch: false })
  },

  // 2. AI识别 - 头像
  async identifyAvatar() {
    this.setData({ showClassifyAction: false })
    if (!this.data.userPlant.avatar) {
      wx.showToast({ title: '暂无头像', icon: 'none' }); return
    }
    wx.showLoading({ title: 'AI识别中...' })
    try {
      const aiIdentify = require('../../utils/ai-identify')
      const result = await aiIdentify.identifyFromUrl(this.data.userPlant.avatar)
      if (result.success && result.plants.length > 0) {
        this.setData({ showClassifyResult: true, classifyResult: result.plants[0] })
      } else {
        wx.showToast({ title: result.error || '识别失败', icon: 'none' })
      }
    } catch (e) {
      wx.showToast({ title: '识别失败', icon: 'none' })
    }
    wx.hideLoading()
  },

  // 3. AI识别 - 拍照/相册
  async identifyPhoto() {
    this.setData({ showClassifyAction: false })
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sizeType: ['compressed'],
      success: async (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: 'AI识别中...' })
        try {
          const aiIdentify = require('../../utils/ai-identify')
          const result = await aiIdentify.identify(tempPath)
          if (result.success && result.plants.length > 0) {
            this.setData({ showClassifyResult: true, classifyResult: result.plants[0] })
          } else {
            wx.showToast({ title: result.error || '识别失败', icon: 'none' })
          }
        } catch (e) {
          wx.showToast({ title: '识别失败', icon: 'none' })
        }
        wx.hideLoading()
      }
    })
  },

  // 从AI识别结果中选取信息更新
  applyClassifyResult() {
    const r = this.data.classifyResult
    if (!r) return
    const updates = {}
    if (r.family) updates.family = r.family
    if (r.genus) updates.genus = r.genus
    if (r.name) updates.latin = r.name
    this._updatePlantClassify(updates)
    this.setData({ showClassifyResult: false })
  },
  hideClassifyResult() {
    this.setData({ showClassifyResult: false })
  },

  // 内部：更新植物分类信息
  async _updatePlantClassify(updates) {
    // 更新本地显示
    const up = { ...this.data.userPlant, ...updates }
    const pi = { ...this.data.plantInfo }
    if (updates.family) pi.category = updates.family
    if (updates.genus) pi.genus = updates.genus
    if (updates.latin) pi.latin = updates.latin
    this.setData({ userPlant: up, plantInfo: pi })

    // 保存到数据库
    const plantId = this.data.userPlant._id || this.data.userPlant.id
    if (this.data.isFamilyMode && plantId) {
      try {
        await family.updatePlant(plantId, updates)
        // 刷新缓存
        await family.getPlants(true)
      } catch (e) {
        wx.showToast({ title: '保存失败', icon: 'none' }); return
      }
    } else if (!this.data.isFamilyMode) {
      storage.updatePlant(this.data.userPlant.id, updates)
    }
    wx.showToast({ title: '已更新', icon: 'none' })
  }
})
