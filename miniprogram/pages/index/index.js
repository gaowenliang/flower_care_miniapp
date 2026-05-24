// pages/index/index.js - 首页：我的花园（支持家庭模式）
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const subscribe = require('../../utils/subscribe')
const family = require('../../utils/family')

// 预设房间
const DEFAULT_ROOMS = ['全部', '阳台', '客厅', '卧室', '书房', '窗台', '花园']

Page({
  data: {
    loading: true,
    garden: [],
    todayTasks: [],
    hasPlants: false,
    stats: null,
    showTip: false,
    tipText: '',
    searchKeyword: '',
    searching: false,
    filteredGarden: [],
    // 房间筛选
    rooms: [],
    activeRoom: '全部',
    showAddRoom: false,
    newRoomName: '',
    _lastLoadTime: 0,
    // 家庭模式
    isFamilyMode: false,
    // 天气
    weather: null,
    weatherLoading: false
  },

  onShow() {
    const now = Date.now()
    if (now - this.data._lastLoadTime < 500) return
    this.setData({ loading: true, _lastLoadTime: now })
    this.loadRooms()
    this.initMode()
  },

  async initMode() {
    // 优先用缓存判断模式，避免每次 onShow 都调云函数
    const cachedInfo = family.getCachedFamily()
    const isFamilyMode = !!cachedInfo && cachedInfo.inFamily
    this.setData({ isFamilyMode })

    if (isFamilyMode) {
      // 先用缓存渲染，后台静默刷新
      this.loadFamilyDataFromCache()
      family.refreshFamilyInfo().then(info => {
        if (info.success && info.inFamily !== isFamilyMode) {
          // 模式变化（退出家庭等），重新初始化
          this.setData({ isFamilyMode: info.inFamily })
          if (info.inFamily) {
            this.loadFamilyData()
          } else {
            this.loadGarden()
            this.loadTodayTasks()
            this.loadStats()
          }
        }
      })
    } else {
      // 个人模式不走云端
      this.loadGarden()
      this.loadTodayTasks()
      this.loadStats()
    }
    this.loadWeather()
    subscribe.checkAndNotify()
    setTimeout(() => this.setData({ loading: false }), 300)
  },

  // ========== 家庭模式数据加载 ==========

  // 从缓存渲染家庭数据（不调云函数）
  loadFamilyDataFromCache() {
    const plants = family.getCachedPlants()
    const allTasks = family.getCachedTasks('')
    const allRecords = family.getCachedRecords('')
    if (plants.length === 0) {
      // 缓存为空，走完整加载
      this.loadFamilyData()
      return
    }
    this._buildFamilyUI(plants, allTasks, allRecords)
  },

  async loadFamilyData() {
    try {
      const plants = await family.getPlants(true)
      const allTasks = await family.getTasks('', true)
      const allRecords = await family.getRecords('', 100, true)
      this._buildFamilyUI(plants || [], allTasks || [], allRecords || [])
    } catch (e) {
      console.error('加载家庭数据失败:', e)
      this.setData({ garden: [], hasPlants: false })
    }
  },

  _buildFamilyUI(plants, allTasks, allRecords) {
    const garden = (plants || []).map(plant => {
        const plantTasks = (allTasks || []).filter(t => t.plantId === plant._id && t.enabled)
        const dueCount = plantTasks.filter(t => {
          return t.nextDate && t.nextDate <= (Date.now() + 86400000)
        }).length
        return {
          ...plant,
          id: plant._id,
          statusEmoji: dueCount > 0 ? '🥺' : '😊',
          hasOverdue: dueCount > 0,
          dueCount,
          addedDays: plant.addedAt ? Math.floor((Date.now() - plant.addedAt) / 86400000) : 0,
          adopterNames: plant.adopterNames || [],
          adopterText: (plant.adopterNames || []).length > 0 ? (plant.adopterNames || []).join('、') : ''
        }
      })

      garden.sort((a, b) => {
        if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1
        return (b.addedAt || 0) - (a.addedAt || 0)
      })

      // 家庭模式下的今日任务
      const todayTasks = []
      garden.forEach(plant => {
        const plantTasks = (allTasks || []).filter(t => t.plantId === plant._id && t.enabled)
        plantTasks.forEach(task => {
          if (task.nextDate && task.nextDate <= (Date.now() + 86400000)) {
            todayTasks.push({
              ...task,
              id: task._id,
              plantName: plant.nickname || plant.name,
              plantEmoji: plant.emoji || '🌱',
              plantId: plant._id,
              daysText: task.nextDate <= Date.now() ? '逾期' : '今天'
            })
          }
        })
      })

      this.setData({
        garden,
        hasPlants: garden.length > 0,
        todayTasks,
        stats: {
          totalPlants: garden.length,
          totalTasks: allTasks.length,
          activeTasks: (allTasks || []).filter(t => t.enabled).length,
          dueToday: todayTasks.length,
          totalRecords: allRecords.length,
          totalCost: (() => {
            const purchaseTotal = garden.reduce((s, p) => s + (p.purchasePrice || 0), 0)
            const costTotal = (allRecords || []).filter(r => r.type === 'cost').reduce((s, r) => s + (r.cost || 0), 0)
            return (purchaseTotal + costTotal).toFixed(2)
          })()
        }
      })
      this.applyFilter()
  },

  // ========== 房间管理 ==========

  loadRooms() {
    let customRooms = []
    try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
    this.setData({ rooms: [...DEFAULT_ROOMS, ...customRooms] })
  },

  switchRoom(e) {
    const room = e.currentTarget.dataset.room
    if (room === '+ 添加') {
      this.setData({ showAddRoom: true, newRoomName: '' })
      return
    }
    this.setData({ activeRoom: room })
    this.applyFilter()
  },

  onNewRoomInput(e) {
    this.setData({ newRoomName: e.detail.value })
  },

  confirmAddRoom() {
    const name = this.data.newRoomName.trim()
    if (!name) { wx.showToast({ title: '请输入房间名', icon: 'none' }); return }
    if (this.data.rooms.includes(name)) { wx.showToast({ title: '该房间已存在', icon: 'none' }); return }
    if (name.length > 6) { wx.showToast({ title: '房间名最多6个字', icon: 'none' }); return }

    let customRooms = []
    try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
    customRooms.push(name)
    try { wx.setStorageSync('customRooms', customRooms) } catch (e) {}

    this.setData({ rooms: [...DEFAULT_ROOMS, ...customRooms], activeRoom: name, showAddRoom: false, newRoomName: '' })
    this.applyFilter()
    wx.showToast({ title: '已添加', icon: 'none' })
  },

  cancelAddRoom() { this.setData({ showAddRoom: false }) },

  deleteRoom(e) {
    const room = e.currentTarget.dataset.room
    if (DEFAULT_ROOMS.includes(room)) { wx.showToast({ title: '预设房间不能删除', icon: 'none' }); return }
    wx.showModal({
      title: '删除房间', content: `确定删除「${room}」？该房间下的植物不会删除。`,
      success: (res) => {
        if (res.confirm) {
          let customRooms = []
          try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
          customRooms = customRooms.filter(r => r !== room)
          try { wx.setStorageSync('customRooms', customRooms) } catch (e) {}
          this.setData({ rooms: [...DEFAULT_ROOMS, ...customRooms], activeRoom: this.data.activeRoom === room ? '全部' : this.data.activeRoom })
          this.applyFilter()
        }
      }
    })
  },

  // ========== 花园数据（个人模式） ==========

  loadGarden() {
    if (this.data.isFamilyMode) return
    let garden = storage.getGarden()
    garden.forEach(plant => {
      const tasks = storage.getTasksByPlant(plant.id).filter(t => t.enabled)
      const dueCount = tasks.filter(t => util.isDueToday(t.nextDate)).length
      plant.statusEmoji = dueCount > 0 ? '🥺' : '😊'
      plant.hasOverdue = dueCount > 0
      plant.dueCount = dueCount
      plant.addedDays = Math.floor((Date.now() - plant.addedAt) / 86400000)
    })
    garden.sort((a, b) => {
      if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1
      return b.addedAt - a.addedAt
    })
    this.setData({ garden, hasPlants: garden.length > 0 })
    this.applyFilter()
  },

  loadTodayTasks() {
    if (this.data.isFamilyMode) return
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
    // 雨天检查已合并到 loadWeather
  },

  loadWeather() {
    try {
      const cached = wx.getStorageSync('_weather_cache')
      if (cached && Date.now() - cached._t < 30 * 60000) {
        this.setData({ weather: cached.data })
        this._checkRainyDayFromCache(cached.data)
        return
      }
    } catch (e) {}
    if (!wx.cloud) return
    this.setData({ weatherLoading: true })
    let city = '310000'
    try { city = wx.getStorageSync('_weather_city') || '310000' } catch (e) {}
    wx.cloud.callFunction({
      name: 'getWeather', data: { city },
      success: (res) => {
        if (res.result && res.result.weather) {
          const w = res.result.weather
          const emojiMap = { '晴': '☀️', '多云': '⛅', '阴': '☁️', '小雨': '🌧️', '中雨': '🌧️', '大雨': '⛈️', '雷阵雨': '⛈️', '小雪': '🌨️', '中雪': '🌨️', '大雪': '❄️', '雾': '🌫️' }
          const weatherEmoji = emojiMap[w.weather] || '🌤️'
          const data = { temp: w.temp, weather: w.weather, emoji: weatherEmoji, humidity: w.humidity, wind: w.wind, city: w.city || '上海' }
          this.setData({ weather: data, weatherLoading: false })
          try { wx.setStorageSync('_weather_cache', { data, _t: Date.now() }) } catch (e) {}
          this._checkRainyDayFromCache(data)
        } else { this.setData({ weatherLoading: false }) }
      },
      fail: () => { this.setData({ weatherLoading: false }) }
    })
  },

  _checkRainyDayFromCache(weatherData) {
    try {
      const weatherTip = wx.getStorageSync('weatherTip_' + util.formatDate(Date.now()))
      if (weatherTip) return
      if (weatherData && weatherData.weather && weatherData.weather.includes('雨')) {
        const waterTasks = this.data.todayTasks.filter(t => t.typeName === '浇水')
        if (waterTasks.length > 0) wx.showToast({ title: `雨天可暂缓浇水（${waterTasks.length}项）`, icon: 'none', duration: 3000 })
        try { wx.setStorageSync('weatherTip_' + util.formatDate(Date.now()), true) } catch(e) {}
      }
    } catch (e) {}
  },

  loadStats() {
    if (this.data.isFamilyMode) return
    const stats = storage.getStats()
    // 个人模式加花费
    const garden = storage.getGarden()
    const records = storage.getRecords()
    const purchaseTotal = garden.reduce((s, p) => s + (p.purchasePrice || 0), 0)
    const costTotal = records.filter(r => r.type === 'cost').reduce((s, r) => s + (r.cost || 0), 0)
    stats.totalCost = (purchaseTotal + costTotal).toFixed(2)
    this.setData({ stats })
  },

  // ========== 搜索/筛选 ==========

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value.trim().toLowerCase(), searching: e.detail.value.trim().length > 0 })
    this.applyFilter()
  },

  clearSearch() { this.setData({ searchKeyword: '', searching: false }); this.applyFilter() },

  applyFilter() {
    let filtered = [...this.data.garden]
    const { searchKeyword, activeRoom } = this.data
    if (activeRoom !== '全部') filtered = filtered.filter(p => p.location === activeRoom)
    if (searchKeyword) {
      filtered = filtered.filter(p =>
        (p.nickname || '').toLowerCase().includes(searchKeyword) ||
        (p.name || '').toLowerCase().includes(searchKeyword) ||
        (p.latin && p.latin.toLowerCase().includes(searchKeyword)) ||
        (p.category && p.category.includes(searchKeyword))
      )
    }
    this.setData({ filteredGarden: filtered })
  },

  // ========== 操作 ==========

  goAddPlant() { wx.switchTab({ url: '/pages/add-plant/add-plant' }) },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/plant-detail/plant-detail?id=${id}` })
  },

  async completeTask(e) {
    const taskId = e.currentTarget.dataset.id
    wx.vibrateShort({ type: 'light' })

    if (this.data.isFamilyMode) {
      const result = await family.completeTask(taskId)
      if (result.success) {
        this.setData({ showTip: true, tipText: '完成啦~' })
        setTimeout(() => this.setData({ showTip: false }), 2000)
        await this.loadFamilyData()
      } else {
        wx.showToast({ title: result.error || '操作失败', icon: 'none' })
      }
      return
    }

    // 个人模式
    const tasks = this.data.todayTasks.map(t => t.id === taskId ? { ...t, completing: true } : t)
    this.setData({ todayTasks: tasks })

    setTimeout(() => {
      storage.completeTask(taskId)
      const task = storage.getTasks().find(t => t.id === taskId)
      if (task) {
        this.setData({ showTip: true, tipText: `${task.typeName}完成！` })
        setTimeout(() => this.setData({ showTip: false }), 2000)
      }
      const achievement = require('../../utils/achievement')
      const newBadges = achievement.checkAchievements()
      if (newBadges.length > 0) {
        setTimeout(() => wx.showToast({ title: `🏆 解锁：${newBadges[0].name}`, icon: 'none', duration: 3000 }), 2200)
      }
      this.loadTodayTasks()
      this.loadGarden()
      this.loadStats()
    }, 280)
  },

  async completeAllTasks() {
    const tasks = this.data.todayTasks
    if (tasks.length === 0) return

    wx.showModal({
      title: '一键完成', content: `确认完成今天的 ${tasks.length} 项养护任务？`,
      success: async (res) => {
        if (res.confirm) {
          if (this.data.isFamilyMode) {
            const results = await Promise.allSettled(tasks.map(t => family.completeTask(t.id)))
            const failures = results.filter(r => r.status === 'rejected' || (r.value && !r.value.success))
            if (failures.length > 0) {
              wx.showToast({ title: `${failures.length}项完成失败`, icon: 'none' })
            }
            await this.loadFamilyData()
          } else {
            tasks.forEach(t => storage.completeTask(t.id))
            this.loadTodayTasks()
            this.loadGarden()
            this.loadStats()
          }
          this.setData({ showTip: true, tipText: `${tasks.length}项全部完成！` })
          setTimeout(() => this.setData({ showTip: false }), 2000)
        }
      }
    })
  },

  onPullDownRefresh() {
    if (this.data.isFamilyMode) {
      this.loadFamilyData().then(() => wx.stopPullDownRefresh())
    } else {
      this.loadGarden()
      this.loadTodayTasks()
      this.loadStats()
      wx.stopPullDownRefresh()
    }
  },

  onShareAppMessage() {
    return { title: `我在养${this.data.garden.length}棵植物，快来一起养花吧！`, path: '/pages/index/index' }
  },

  onShareTimeline() {
    return { title: `我在养${this.data.garden.length}棵植物，快来一起养花吧！`, query: '' }
  }
})
