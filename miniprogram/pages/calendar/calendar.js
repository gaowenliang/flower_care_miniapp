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
    recordMap: {},
    selectedRecords: [],
    photoTimeline: [],
    loading: true,
    // 导入相关
    showImportModal: false,
    importing: false,
    importRecords: [],
    importChecked: {},
    importMembers: [],
    selectedImportMember: '',
    importPlants: [],
    selectedImportPlant: null,
    monthPad: '01' 
  },

  onLoad() {
    const now = new Date()
    this.setData({ year: now.getFullYear(), month: now.getMonth() + 1, monthPad: String(now.getMonth() + 1).padStart(2, '0'), today: util.formatDate(now), isFamilyMode: family.isInFamily() })
    this.buildCalendar()
  },

  onShow() {
    this.setData({ isFamilyMode: family.isInFamily() })
    if (this.data.isFamilyMode) {
      family.getRecords('', 100).then(() => this.buildCalendar()).catch(() => this.buildCalendar())
      this.loadFamilyPhotoTimeline()
    } else {
      this.buildCalendar()
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

    // 家庭模式：加载已完成记录到 recordMap
    let recordMap = {}
    if (isFamilyMode) {
      const allRecords = family.getCachedRecords() || []
      allRecords.forEach(r => {
        const dateStr = util.formatDate(r.date)
        if (!recordMap[dateStr]) recordMap[dateStr] = []
        const plant = garden.find(p => p.id === (r.userPlantId || r.plantId))
        recordMap[dateStr].push({
          id: r._id, type: r.type, typeName: r.typeName, note: r.note || '',
          date: r.date, plantName: plant ? plant.nickname : '未知', plantEmoji: plant ? plant.emoji : '🌱',
          creatorNickname: r.creatorNickname || ''
        })
      })
    }

    const days = []
    for (let i = 0; i < firstDay; i++) days.push({ day: '', empty: true })
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const tasksForDay = taskMap[dateStr] || []
      days.push({ day: d, date: dateStr, isToday: dateStr === this.data.today, hasTask: tasksForDay.length > 0, hasRecord: (recordMap[dateStr] || []).length > 0, taskCount: tasksForDay.length })
    }

    this.setData({ days, taskMap, recordMap })
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
      selectedTasks: this.data.taskMap[date] || [],
      selectedRecords: this.data.recordMap[date] || []
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
  async startImport() {
    wx.chooseMedia({
      count: 9, mediaType: ['image'], sizeType: ['compressed'],
      success: async (res) => {
        this.setData({ importing: true })
        try {
          // 上传到云存储
          const fileIDs = []
          for (const file of res.tempFiles) {
            const uploadRes = await wx.cloud.uploadFile({ cloudPath: `import/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`, filePath: file.tempFilePath })
            if (uploadRes.fileID) fileIDs.push(uploadRes.fileID)
          }
          if (fileIDs.length === 0) {
            wx.showToast({ title: '图片上传失败', icon: 'none' }); this.setData({ importing: false }); return
          }
          const result = await wx.cloud.callFunction({ name: 'importScreenshot', data: { fileIDs } })
          if (result.result && result.result.success && result.result.records.length > 0) {
            const checked = {}
            result.result.records.forEach((r, i) => { checked[i] = true })
            // 获取家庭成员列表
            const familyInfo = family.getCachedFamily()
            const members = (familyInfo && familyInfo.members) || []
            const currentUser = members.find(m => m.role === 'admin') || members[0] || {}
            // 获取植物列表
            const plants = family.getCachedPlants() || []
            this.setData({ showImportModal: true, importRecords: result.result.records, importChecked: checked, importing: false, importMembers: members, selectedImportMember: currentUser.openid || '', importPlants: plants, selectedImportPlant: plants[0] || null })
          } else {
            wx.showToast({ title: (result.result && result.result.error) || '未识别到养护记录', icon: 'none', duration: 3000 })
            this.setData({ importing: false })
          }
        } catch (e) {
          console.error('导入失败:', e)
          const msg = (e && e.errMsg) || (e && e.message) || '未知错误'
          wx.showToast({ title: '失败: ' + msg, icon: 'none', duration: 3000 })
          this.setData({ importing: false })
        }
      }
    })
  },

  toggleImportItem(e) {
    const idx = e.currentTarget.dataset.idx
    this.setData({ [`importChecked.${idx}`]: !this.data.importChecked[idx] })
  },

  hideImportModal() { this.setData({ showImportModal: false }) },

  selectImportMember(e) {
    this.setData({ selectedImportMember: e.currentTarget.dataset.openid })
  },

  selectImportPlant(e) {
    const plant = this.data.importPlants.find(p => p._id === e.currentTarget.dataset.id)
    this.setData({ selectedImportPlant: plant || null })
  },

  async confirmImport() {
    const records = this.data.importRecords.filter((r, i) => this.data.importChecked[i])
    if (records.length === 0) { wx.showToast({ title: '请选择要导入的记录', icon: 'none' }); return }

    // 需要选植物和成员
    if (!this.data.selectedImportPlant) { wx.showToast({ title: '请选择植物', icon: 'none' }); return }

    wx.showLoading({ title: '导入中...' })
    try {
      const importRecords = records.map(r => {
        const dateValue = r.date ? new Date(r.date.replace(/\//g, '-')).getTime() : Date.now()
        return {
          type: r.actionType || 'water',
          typeName: r.action,
          date: isNaN(dateValue) ? Date.now() : dateValue,
          note: r.note || ''
        }
      })

      const result = await wx.cloud.callFunction({
        name: 'familyData',
        data: {
          action: 'batchImportRecords',
          plantId: this.data.selectedImportPlant._id,
          records: importRecords,
          createdBy: this.data.selectedImportMember || ''
        }
      })

      wx.hideLoading()
      const res = result.result || {}
      if (res.success) {
        this.setData({ showImportModal: false })
        wx.showToast({ title: `导入${res.total || 0}条（新增${res.imported || 0}，更新${res.updated || 0}）`, icon: 'none', duration: 3000 })
        // 刷新缓存再重建日历
        if (this.data.isFamilyMode) {
          await family.getRecords('', 100, true) // forceRefresh
        }
        this.buildCalendar()
      } else {
        wx.showToast({ title: res.error || '导入失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      const errMsg = (e.errMsg || e.message || '').toString()
      wx.showModal({ title: '导入失败', content: errMsg || '未知错误', showCancel: false })
      console.error('批量导入失败:', e)
    }
  },

  preventBubble() {}
})
