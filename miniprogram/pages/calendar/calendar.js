// pages/calendar/calendar.js - 统一走 StorageManager
const util = require('../../utils/util')
const storage = require('../../utils/storage')

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
    photoTimeline: []
  },

  onLoad() {
    const now = new Date()
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      today: util.formatDate(now)
    })
    this.buildCalendar()
  },

  onShow() {
    this.buildCalendar()
    this.loadPhotoTimeline()
  },

  getDueDatesInMonth(task, year, month) {
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

  buildCalendar() {
    const { year, month } = this.data
    const firstDay = new Date(year, month - 1, 1).getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const garden = storage.getGarden()
    const tasks = storage.getActiveTasks()

    const taskMap = {}
    tasks.forEach(task => {
      const plant = garden.find(p => p.id === task.userPlantId)
      const dueDates = this.getDueDatesInMonth(task, year, month)
      dueDates.forEach(dateTs => {
        const dateStr = util.formatDate(dateTs)
        if (!taskMap[dateStr]) taskMap[dateStr] = []
        taskMap[dateStr].push({
          ...task,
          plantName: plant ? plant.nickname : '未知',
          plantEmoji: plant ? plant.emoji : '🌱'
        })
      })
    })

    const days = []
    for (let i = 0; i < firstDay; i++) days.push({ day: '', empty: true })
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const tasksForDay = taskMap[dateStr] || []
      days.push({
        day: d, date: dateStr,
        isToday: dateStr === this.data.today,
        hasTask: tasksForDay.length > 0,
        taskCount: tasksForDay.length
      })
    }

    this.setData({ days, taskMap })
  },

  prevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month, selectedDate: null })
    this.buildCalendar()
  },

  nextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month, selectedDate: null })
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
  }
})
