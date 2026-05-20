// pages/calendar/calendar.js - 优化版：按周期循环计算每月所有到期日
const app = getApp()
const util = require('../../utils/util')

Page({
  data: {
    year: 2026,
    month: 1,
    days: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    selectedDate: null,
    selectedTasks: [],
    today: '',
    taskMap: {}
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
  },

  // 计算某任务在指定月份的所有到期日期
  getDueDatesInMonth(task, year, month) {
    const daysInMonth = new Date(year, month, 0).getDate()
    const dueDates = []

    // 从 lastDoneDate 开始，按 intervalDays 递推
    let cursor = task.lastDoneDate + task.intervalDays * 86400000
    const monthStart = new Date(year, month - 1, 1).getTime()
    const monthEnd = new Date(year, month, 0, 23, 59, 59).getTime()

    // 安全限制：最多推算365天避免死循环
    let safety = 0
    while (cursor <= monthEnd && safety < 365) {
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
    const garden = app.getMyGarden()
    const tasks = app.getCareTasks().filter(t => t.enabled)

    // 构建任务日期映射
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

    // 构建日历天数
    const days = []
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: '', empty: true })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const tasksForDay = taskMap[dateStr] || []
      days.push({
        day: d,
        date: dateStr,
        isToday: dateStr === this.data.today,
        hasTask: tasksForDay.length > 0,
        taskCount: tasksForDay.length,
        isPast: new Date(dateStr) < new Date(this.data.today)
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
  }
})
