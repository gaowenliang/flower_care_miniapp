// pages/index/index.js - 首页：我的花园（房间筛选+自定义房间）
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const subscribe = require('../../utils/subscribe')

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
    _lastLoadTime: 0
  },

  onShow() {
    // 节流：500ms内不重复加载
    const now = Date.now()
    if (now - this.data._lastLoadTime < 500) return
    this.setData({ loading: true, _lastLoadTime: now })
    this.loadRooms()
    this.loadGarden()
    this.loadTodayTasks()
    this.loadStats()
    subscribe.checkAndNotify()
    // 骨架屏最少显示300ms，避免闪烁
    setTimeout(() => this.setData({ loading: false }), 300)
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
    if (!name) {
      wx.showToast({ title: '请输入房间名', icon: 'none' })
      return
    }
    if (this.data.rooms.includes(name)) {
      wx.showToast({ title: '该房间已存在', icon: 'none' })
      return
    }
    if (name.length > 6) {
      wx.showToast({ title: '房间名最多6个字', icon: 'none' })
      return
    }

    let customRooms = []
    try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
    customRooms.push(name)
    try { wx.setStorageSync('customRooms', customRooms) } catch (e) {}

    this.setData({
      rooms: [...DEFAULT_ROOMS, ...customRooms],
      activeRoom: name,
      showAddRoom: false,
      newRoomName: ''
    })
    this.applyFilter()
    wx.showToast({ title: '已添加', icon: 'none' })
  },

  cancelAddRoom() {
    this.setData({ showAddRoom: false })
  },

  // 长按删除自定义房间
  deleteRoom(e) {
    const room = e.currentTarget.dataset.room
    if (DEFAULT_ROOMS.includes(room)) {
      wx.showToast({ title: '预设房间不能删除', icon: 'none' })
      return
    }

    wx.showModal({
      title: '删除房间',
      content: `确定删除「${room}」？该房间下的植物不会删除。`,
      success: (res) => {
        if (res.confirm) {
          let customRooms = []
          try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
          customRooms = customRooms.filter(r => r !== room)
          try { wx.setStorageSync('customRooms', customRooms) } catch (e) {}
          this.setData({
            rooms: [...DEFAULT_ROOMS, ...customRooms],
            activeRoom: this.data.activeRoom === room ? '全部' : this.data.activeRoom
          })
          this.applyFilter()
        }
      }
    })
  },

  // ========== 花园数据 ==========

  loadGarden() {
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

    // 雨天提示
    this.checkRainyDay()
  },

  checkRainyDay() {
    // 检查今天天气，如果下雨且有待浇水任务则提示
    try {
      const weatherTip = wx.getStorageSync('weatherTip_' + util.formatDate(Date.now()))
      if (weatherTip) return
      wx.request({
        url: 'https://restapi.amap.com/v3/weather/weatherInfo?key=de9c6192fc5bc7a1e4dfa319f6c26ee8&city=310000&extensions=base',
        success: (res) => {
          if (res.data && res.data.lives && res.data.lives[0]) {
            const w = res.data.lives[0]
            if (w.weather && (w.weather.includes('雨'))) {
              const waterTasks = this.data.todayTasks.filter(t => t.typeName === '浇水')
              if (waterTasks.length > 0) {
                wx.showToast({ title: `雨天可暂缓浇水（${waterTasks.length}项）`, icon: 'none', duration: 3000 })
              }
            }
            try { wx.setStorageSync('weatherTip_' + util.formatDate(Date.now()), true) } catch(e) {}
          }
        }
      })
    } catch (e) {}
  },

  loadStats() {
    this.setData({ stats: storage.getStats() })
  },

  // 搜索
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value.trim().toLowerCase(), searching: e.detail.value.trim().length > 0 })
    this.applyFilter()
  },

  clearSearch() {
    this.setData({ searchKeyword: '', searching: false })
    this.applyFilter()
  },

  applyFilter() {
    let filtered = [...this.data.garden]
    const { searchKeyword, activeRoom } = this.data

    // 房间筛选
    if (activeRoom !== '全部') {
      filtered = filtered.filter(p => p.location === activeRoom)
    }

    // 搜索筛选
    if (searchKeyword) {
      filtered = filtered.filter(p =>
        p.nickname.toLowerCase().includes(searchKeyword) ||
        p.name.toLowerCase().includes(searchKeyword) ||
        (p.latin && p.latin.toLowerCase().includes(searchKeyword)) ||
        (p.category && p.category.includes(searchKeyword))
      )
    }

    this.setData({ filteredGarden: filtered })
  },

  // ========== 操作 ==========

  goAddPlant() {
    wx.switchTab({ url: '/pages/add-plant/add-plant' })
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/plant-detail/plant-detail?id=${e.currentTarget.dataset.id}` })
  },

  completeTask(e) {
    const taskId = e.currentTarget.dataset.id
    // 触感反馈
    wx.vibrateShort({ type: 'light' })
    // 播放滑出动画
    const tasks = this.data.todayTasks.map(t =>
      t.id === taskId ? { ...t, completing: true } : t
    )
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
        setTimeout(() => {
          wx.showToast({ title: `🏆 解锁：${newBadges[0].name}`, icon: 'none', duration: 3000 })
        }, 2200)
      }

      this.loadTodayTasks()
      this.loadGarden()
      this.loadStats()
    }, 280)
  },

  completeAllTasks() {
    const tasks = this.data.todayTasks
    if (tasks.length === 0) return
    wx.showModal({
      title: '一键完成',
      content: `确认完成今天的 ${tasks.length} 项养护任务？`,
      success: (res) => {
        if (res.confirm) {
          tasks.forEach(t => storage.completeTask(t.id))
          this.setData({ showTip: true, tipText: `${tasks.length}项全部完成！` })
          setTimeout(() => this.setData({ showTip: false }), 2000)
          this.loadTodayTasks()
          this.loadGarden()
          this.loadStats()
        }
      }
    })
  },

  onPullDownRefresh() {
    this.loadGarden()
    this.loadTodayTasks()
    this.loadStats()
    wx.stopPullDownRefresh()
  },

  onShareAppMessage() {
    return { title: `我在养${this.data.garden.length}棵植物，快来一起养花吧！`, path: '/pages/index/index' }
  },

  onShareTimeline() {
    return {
      title: `我在养${this.data.garden.length}棵植物，快来一起养花吧！`,
      query: ''
    }
  }
})
