// pages/calendar/calendar.js - 统一走 StorageManager（支持家庭模式）
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const family = require('../../utils/family')

Page({
  data: {
    year: 2026,
    month: 1,
    days: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    selectedDate: null,
    selectedTasks: [],
    today: '',
    taskMap: {},
    photoTimeline: [],
    loading: true,
    // 导入相关
    showImportModal: false,
    importing: false,
    importRecords: [],
    importChecked: {},
    monthPad: '01' 
  },

  onLoad() {
    const now = new Date()
    this.setData({ year: now.getFullYear(), month: now.getMonth() + 1, monthPad: String(now.getMonth() + 1).padStart(2, '0'), today: util.formatDate(now), isFamilyMode: family.isInFamily() })
    this.buildCalendar()
  },

  onShow() {
    this.setData({ isFamilyMode: family.isInFamily() })
    this.buildCalendar()
    if (this.data.isFamilyMode) {
      this.loadFamilyPhotoTimeline()
    } else {
      this.loadPhotoTimeline()
    }
    setTimeout(() => this.setData({ loading: false }), 300)
  },

  getDueDatesInMonth(task, year, month) {
    if (!task.intervalDays || task.intervalDays <= 0) return []
    const monthStart = new Date(year, month - 1, 1).getTime()
    const monthEnd = new Date(year, month, 0, 23, 59, 59).getTime()
    const dueDates = []
    let cursor = task.lastDoneDate + task.intervalDays * 86400000
    let safety = 0
    while (cursor <= monthEnd && safety < 50) {
      if (cursor >= monthStart) {
        dueDates.push(cursor)
      }
      cursor += task.intervalDays * 86400000
      safety++
    }
    return dueDates
  },

  async buildCalendar() {
    const { year, month, isFamilyMode } = this.data
    const firstDay = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()

    let garden, tasks

    if (isFamilyMode) {
      garden = family.getCachedPlants().map(p => ({ ...p, id: p._id })) || []
      const allTasks = family.getCachedTasks() || []
      tasks = allTasks.filter(t => t.enabled)
    } else {
      garden = storage.getGarden()
      tasks = storage.getActiveTasks()
    }

    const taskMap = {}
    tasks.forEach(task => {
      const plant = garden.find(p => p.id === (task.userPlantId || task.plantId))
      const dueDates = this.getDueDatesInMonth(task, year, month)
      dueDates.forEach(dateTs => {
        const dateStr = util.formatDate(dateTs)
        if (!taskMap[dateStr]) taskMap[dateStr] = []
        taskMap[dateStr].push({ ...task, plantName: plant ? plant.nickname : '未知', plantEmoji: plant ? plant.emoji : '🌱' })
      })
    })

    const days = []
    for (let i = 0; i < firstDay; i++) days.push({ day: '', empty: true })
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const tasksForDay = taskMap[dateStr] || []
      days.push({ day: d, date: dateStr, isToday: dateStr === this.data.today, hasTask: tasksForDay.length > 0, taskCount: tasksForDay.length })
    }

    this.setData({ days, taskMap })
  },

  prevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month, monthPad: String(month).padStart(2, '0'), selectedDate: null })
    this.buildCalendar()
  },

  nextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month, monthPad: String(month).padStart(2, '0'), selectedDate: null })
    this.buildCalendar()
  },

  onMonthPickerChange(e) {
    const val = e.detail.value // "2026-05"
    const [y, m] = val.split('-').map(Number)
    this.setData({ year: y, month: m, monthPad: String(m).padStart(2, '0'), selectedDate: null })
    this.buildCalendar()
  },

  selectDate(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    this.setData({
      selectedDate: date,
      selectedTasks: this.data.taskMap[date] || []
    })
  },

  async loadFamilyPhotoTimeline() {
    const records = await family.getRecords('', 50) || []
    const garden = family.getCachedPlants()
    const timeline = records.filter(r => r.type === 'photo' && r.photo).sort((a, b) => b.date - a.date).map(r => {
      const plant = garden.find(p => p._id === r.plantId)
      return { id: r._id, photo: r.photo, plantName: plant ? plant.nickname : '未知植物', plantEmoji: plant ? plant.emoji : '🌱', dateStr: util.formatDate(r.date), timeStr: new Date(r.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }
    })
    this.setData({ photoTimeline: timeline })
  },

  loadPhotoTimeline() {
    const garden = storage.getGarden()
    const records = storage.getRecords()
      .filter(r => r.type === 'photo' && r.photo)
      .sort((a, b) => b.date - a.date)
      .map(r => {
        const plant = garden.find(p => p.id === r.userPlantId)
        return {
          id: r.id,
          photo: r.photo,
          plantName: plant ? plant.nickname : '未知植物',
          plantEmoji: plant ? plant.emoji : '🌱',
          dateStr: util.formatDate(r.date),
          timeStr: util.formatTime ? util.formatTime(r.date) : new Date(r.date).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }
      })
    this.setData({ photoTimeline: records })
  },

  previewPhoto(e) {
    const url = e.currentTarget.dataset.url
    const urls = this.data.photoTimeline.map(p => p.photo)
    wx.previewImage({ current: url, urls })
  },

  onPullDownRefresh() {
    this.buildCalendar()
    if (this.data.isFamilyMode) {
      this.loadFamilyPhotoTimeline()
    } else {
      this.loadPhotoTimeline()
    }
    wx.stopPullDownRefresh()
  },

  // ========== 导入功能 ==========
  startImport() {
    const that = this
    wx.chooseMedia({
      count: 9, mediaType: ['image'], sizeType: ['compressed'],
      success: async (res) => {
        that.setData({ importing: true })
        try {
          // 压缩并转base64
          const images = []
          for (const file of res.tempFiles) {
            const b64 = await that._imageToBase64(file.tempFilePath)
            if (b64) images.push(b64)
          }
          if (images.length === 0) {
            wx.showToast({ title: '图片处理失败', icon: 'none' }); that.setData({ importing: false }); return
          }
          // 调云函数
          const result = await wx.cloud.callFunction({ name: 'importScreenshot', data: { images } })
          if (result.result && result.result.success && result.result.records.length > 0) {
            const checked = {}
            result.result.records.forEach((r, i) => { checked[i] = true })
            that.setData({ showImportModal: true, importRecords: result.result.records, importChecked: checked, importing: false })
          } else {
            wx.showToast({ title: (result.result && result.result.error) || '未识别到养护记录，请确认截图内容', icon: 'none', duration: 3000 })
            that.setData({ importing: false })
          }
        } catch (e) {
          console.error('导入失败:', e)
          wx.showToast({ title: '识别失败: ' + (e.errMsg || ''), icon: 'none' })
          that.setData({ importing: false })
        }
      }
    })
  },

  _imageToBase64(filePath) {
    return new Promise((resolve) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => resolve(res.data),
        fail: () => resolve(null)
      })
    })
  },

  toggleImportItem(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ [`importChecked.${idx}`]: !this.data.importChecked[idx] })
  },

  hideImportModal() { this.setData({ showImportModal: false }) },

  async confirmImport() {
    const records = this.data.importRecords.filter((r, i) => this.data.importChecked[i])
    if (records.length === 0) { wx.showToast({ title: '请选择要导入的记录', icon: 'none' }); return }

    wx.showLoading({ title: '导入中...' })
    let imported = 0

    for (const r of records) {
      try {
        // 查找或创建植物
        const plants = await family.getPlants(false)
        let plant = plants.find(p => (p.nickname || p.name) === r.plantName || p.name === r.plantName)

        if (!plant) {
          // 创建植物
          const addResult = await family.addPlant({
            plantId: 'import_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            name: r.plantName, latin: '', family: '', genus: '',
            emoji: '🌱', category: '导入', nickname: r.plantName,
            location: '阳台', waterDays: 7
          })
          if (addResult.success) {
            const freshPlants = await family.getPlants(true)
            plant = freshPlants.find(p => (p.nickname || p.name) === r.plantName)
          }
        }

        if (plant) {
          // 添加养护记录
          await family.addRecord({
            plantId: plant._id,
            type: r.actionType || 'water',
            typeName: r.action,
            date: r.date ? new Date(r.date.replace(/\//g, '-')).getTime() : Date.now()
          })
          imported++
        }
      } catch (e) {
        console.error('导入单条失败:', r, e)
      }
    }

    wx.hideLoading()
    this.setData({ showImportModal: false })
    wx.showToast({ title: `成功导入${imported}条记录`, icon: 'none', duration: 2000 })
    this.buildCalendar()
  }
})
