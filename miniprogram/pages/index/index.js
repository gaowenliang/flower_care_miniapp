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
    weatherLoading: false,
    weatherError: ''
  },

  onShow() {
    const now = Date.now()
    if (now - this.data._lastLoadTime < 500) return
    this.setData({ loading: true, _lastLoadTime: now })
    this.initMode()
  },

  async initMode() {
    // 必须加入家庭才能使用
    const cachedInfo = family.getCachedFamily()
    if (cachedInfo && cachedInfo.inFamily) {
      this.setData({ isFamilyMode: true })
      this.loadFamilyDataFromCache()
      family.refreshFamilyInfo().then(info => {
        if (info.success && !info.inFamily) {
          // 被踢出家庭了，跳转家庭页
          wx.redirectTo({ url: '/pages/family/family' })
        }
      })
    } else {
      const info = await family.refreshFamilyInfo()
      if (info.success && info.inFamily) {
        this.setData({ isFamilyMode: true })
        this.loadFamilyData()
      } else {
        // 未加入家庭，跳转家庭页
        wx.redirectTo({ url: '/pages/family/family' })
        return
      }
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
        if (a.dead !== b.dead) return a.dead ? 1 : -1
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
      this.loadRooms() // 数据加载后再刷新房间列表（确保💀天堂出现）
      this.applyFilter()
  },

  // ========== 房间管理 ==========

  loadRooms() {
    let customRooms = []
    try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
    // 直接用 this.data.garden（已经 setData 过了）
    const garden = this.data.garden
    const hasDead = garden && garden.some(p => p.dead)
    if (hasDead && !customRooms.includes('💀 天堂')) {
      customRooms.push('💀 天堂')
      try { wx.setStorageSync('customRooms', customRooms) } catch (e) {}
    }
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

  goRoomManage() {
    wx.navigateTo({ url: '/pages/room-manage/room-manage' })
  },

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
      // 嘎了的排最后
      if (a.dead !== b.dead) return a.dead ? 1 : -1
      if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1
      return b.addedAt - a.addedAt
    })
    this.setData({ garden, hasPlants: garden.length > 0 })
    this.loadRooms() // 个人模式也刷新房间列表
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
        this.setData({ weather: cached.data, weatherError: '' })
        this._checkRainyDayFromCache(cached.data)
        return
      }
    } catch (e) {}
    if (!wx.cloud) {
      this.setData({ weatherError: '云开发未启用' })
      return
    }
    this.setData({ weatherLoading: true, weatherError: '' })
    let city = ''
    try { city = wx.getStorageSync('_weather_city') || '' } catch (e) {}
    if (!city) {
      // 没有缓存城市，尝试定位
      wx.getLocation({
        type: 'gcj02',
        success: (loc) => {
          city = `${loc.longitude},${loc.latitude}`
          try { wx.setStorageSync('_weather_city', city) } catch (e) {}
          this._fetchWeather(city)
        },
        fail: () => {
          city = '310000'
          try { wx.setStorageSync('_weather_city', city) } catch (e) {}
          this._fetchWeather(city)
        }
      })
      return
    }
    this._fetchWeather(city)
  },

  _fetchWeather(city) {
    this.setData({ weatherLoading: true })
    // 先试云函数
    const tryCloud = () => {
      if (!wx.cloud) return Promise.reject(new Error('no cloud'))
      return new Promise((resolve, reject) => {
        wx.cloud.callFunction({
          name: 'getWeather', data: { city },
          success: (res) => {
            if (res.result && res.result.weather) resolve(res.result.weather)
            else reject(new Error(res.result ? (res.result.error || '天气数据为空') : '云函数返回异常'))
          },
          fail: (err) => reject(err)
        })
      })
    }
    // 云函数失败 → 天气不可用（不暴露 API Key）
    tryCloud().then(w => {
      const emojiMap = { '晴': '☀️', '多云': '⛅', '阴': '☁️', '小雨': '🌧️', '中雨': '🌧️', '大雨': '⛈️', '雷阵雨': '⛈️', '小雪': '🌨️', '中雪': '🌨️', '大雪': '❄️', '雾': '🌫️' }
      const weatherEmoji = emojiMap[w.weather] || '🌤️'
      const data = { temp: w.temperature, weather: w.weather, emoji: weatherEmoji, humidity: w.humidity, wind: w.windpower, city: w.city || '上海' }
      this.setData({ weather: data, weatherLoading: false })
      try { wx.setStorageSync('_weather_cache', { data, _t: Date.now() }) } catch (e) {}
      this._checkRainyDayFromCache(data)
    }).catch(err => {
      this.setData({ weatherLoading: false, weatherError: (err.message || '获取天气失败') })
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
    // 【全部】不显示嘎了的植物，只在【💀天堂】显示
    if (activeRoom === '全部') filtered = filtered.filter(p => !p.dead)
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
  goIdentify() { wx.navigateTo({ url: '/pages/identify/identify' }) },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/plant-detail/plant-detail?id=${id}` })
  },

  showPlantActions(e) {
    const idx = e.currentTarget.dataset.idx
    const plant = this.data.filteredGarden[idx]
    if (!plant) return

    const items = ['💧 浇水', '🧪 施肥', '✂️ 修剪', '📍 查看/编辑']
    wx.showActionSheet({
      alertText: plant.nickname,
      itemList: items,
      success: async (res) => {
        const tapIndex = res.tapIndex
        if (tapIndex === 3) {
          // 查看详情
          wx.navigateTo({ url: `/pages/plant-detail/plant-detail?id=${plant.id}` })
          return
        }
        // 快捷养护
        const typeMap = ['water', 'fertilize', 'prune']
        const nameMap = ['浇水', '施肥', '修剪']
        const type = typeMap[tapIndex]
        const typeName = nameMap[tapIndex]
        if (!type) return

        if (this.data.isFamilyMode) {
          const tasks = family.getCachedTasks(plant._id || plant.id)
          const task = tasks.find(t => t.type === type && t.enabled !== false)
          if (task) {
            wx.showLoading({ title: '完成中...' })
            const result = await family.completeTask(task._id || task.id)
            wx.hideLoading()
            if (result.success) {
              this.setData({ showTip: true, tipText: `${plant.nickname} ${typeName}完成！` })
              setTimeout(() => this.setData({ showTip: false }), 2000)
              await this.loadFamilyData()
            } else {
              wx.showToast({ title: result.error || '操作失败', icon: 'none' })
            }
          } else {
            wx.showToast({ title: '暂无该养护任务', icon: 'none' })
          }
        } else {
          const tasks = storage.getTasksByPlant(plant.id)
          const task = tasks.find(t => t.type === type && t.enabled)
          if (task) {
            storage.completeTask(task.id)
            storage.addRecord({
              id: util.genId(), userPlantId: plant.id, type, typeName,
              date: Date.now(), note: typeName
            })
            this.setData({ showTip: true, tipText: `${plant.nickname} ${typeName}完成！` })
            setTimeout(() => this.setData({ showTip: false }), 2000)
            this.loadGarden()
            this.loadStats()
          } else {
            wx.showToast({ title: '暂无该养护任务', icon: 'none' })
          }
        }
      }
    })
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

    // 家庭模式
    const tasks = this.data.todayTasks.map(t => t.id === taskId ? { ...t, completing: true } : t)
    this.setData({ todayTasks: tasks })

    setTimeout(async () => {
      try {
        const result = await family.completeTask(taskId)
        if (result.success) {
          this.setData({ showTip: true, tipText: '完成啦~' })
          setTimeout(() => this.setData({ showTip: false }), 2000)
          await this.loadFamilyData()
        } else {
          wx.showToast({ title: result.error || '操作失败', icon: 'none' })
        }
      } catch (e) {
        wx.showToast({ title: '操作失败', icon: 'none' })
      }
    }, 280)
  },

  // ========== 推迟任务 ==========
  async postponeTask(e) {
    const taskId = e.currentTarget.dataset.id
    const idx = e.currentTarget.dataset.idx
    const task = this.data.todayTasks[idx]
    if (!task) return

    if (this.data.isFamilyMode) {
      const newNextDate = Date.now() + 86400000
      const result = await family.updateTask(taskId, { nextDate: newNextDate })
      if (result.success) {
        // 写日志记录
        try {
          await wx.cloud.callFunction({
            name: 'familyData',
            data: {
              action: 'addRecord',
              data: {
                plantId: task.plantId,
                type: 'postpone',
                typeName: '推迟',
                note: `${task.typeName}推迟至明天`
              }
            }
          })
        } catch (e) { /* 日志失败不影响主流程 */ }
        wx.showToast({ title: '已推迟到明天', icon: 'none' })
        // 从列表移除，不重新加载（第二天才显示）
        const updated = this.data.todayTasks.filter((_, i) => i !== idx)
        this.setData({ todayTasks: updated })
      } else {
        wx.showToast({ title: result.error || '操作失败', icon: 'none' })
      }
    } else {
      // 个人模式
      const tasks = storage.getTasks()
      const t = tasks.find(t => t.id === taskId)
      if (t) {
        t.nextDate = Date.now() + 86400000
        try { wx.setStorageSync(storage.KEYS.TASKS, tasks) } catch (e) {}
        // 写日志
        const records = storage.getRecords()
        records.unshift({
          id: 'postpone_' + Date.now(),
          userPlantId: task.plantId || task.userPlantId,
          type: 'postpone',
          typeName: '推迟',
          date: Date.now(),
          note: `${task.typeName}推迟至明天`
        })
        try { wx.setStorageSync(storage.KEYS.RECORDS, records) } catch (e) {}
      }
      wx.showToast({ title: '已推迟到明天', icon: 'none' })
      const updated = this.data.todayTasks.filter((_, i) => i !== idx)
      this.setData({ todayTasks: updated })
    }
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
          }
          this.setData({ showTip: true, tipText: `${tasks.length}项全部完成！` })
          setTimeout(() => this.setData({ showTip: false }), 2000)
        }
      }
    })
  },

  // 给当前房间的活植物浇水
  async waterRoom() {
    const room = this.data.activeRoom
    const plants = this.data.filteredGarden.filter(p => !p.dead)
    if (plants.length === 0) {
      wx.showToast({ title: '没有需要浇水的植物', icon: 'none' }); return
    }
    const roomText = room === '全部' ? '所有植物' : room + '的植物'
    wx.showModal({
      title: '一键浇水', content: `给${roomText}（${plants.length}棵）浇水？`,
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '浇水中...' })
        let done = 0
        if (this.data.isFamilyMode) {
          for (const plant of plants) {
            const tasks = family.getCachedTasks(plant._id || plant.id)
            const waterTask = tasks.find(t => t.type === 'water' && t.enabled)
            if (waterTask) {
              await family.completeTask(waterTask._id || waterTask.id).catch(() => {})
              done++
            }
          }
          await this.loadFamilyData()
        } else {
          for (const plant of plants) {
            const tasks = storage.getTasksByPlant(plant.id)
            const waterTask = tasks.find(t => t.type === 'water' && t.enabled)
            if (waterTask) {
              storage.completeTask(waterTask.id)
              storage.addRecord({ id: util.genId(), userPlantId: plant.id, type: 'water', typeName: '浇水', date: Date.now(), note: '房间一键浇水' })
              done++
            }
          }
          this.loadGarden()
          this.loadTodayTasks()
          this.loadStats()
        }
        wx.hideLoading()
        this.setData({ showTip: true, tipText: `💧 ${done}棵植物已浇水！` })
        setTimeout(() => this.setData({ showTip: false }), 2000)
      }
    })
  },

  onPullDownRefresh() {
    this.loadFamilyData().then(() => wx.stopPullDownRefresh())
  },

  onShareAppMessage() {
    const count = this.data.garden.length
    const alive = this.data.garden.filter(p => !p.dead).length
    const days = this.data.garden.length > 0 ? Math.max(...this.data.garden.map(p => Math.floor((Date.now() - (p.addedAt || Date.now())) / 86400000))) : 0
    return {
      title: count === 0 ? '开始你的养花之旅吧~' : `我养了${alive}棵植物${days > 0 ? '，最长' + days + '天了' : ''}！`,
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    const count = this.data.garden.length
    const alive = this.data.garden.filter(p => !p.dead).length
    return { title: count === 0 ? '养花助手 - 开始你的花园' : `我在养${alive}棵植物，快来一起养花~`, query: '' }
  }
})
