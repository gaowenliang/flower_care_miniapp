// pages/calendar/calendar.js - 养护日历
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

  // 构建日历
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
      // 生成本月所有日期
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        const next = new Date(task.nextDate)
        const check = new Date(dateStr)
        if (next.toDateString() === check.toDateString()) {
          if (!taskMap[dateStr]) taskMap[dateStr] = []
          taskMap[dateStr].push({
            ...task,
            plantName: plant ? plant.nickname : '未知',
            plantEmoji: plant ? plant.emoji : '🌱'
          })
        }
      }
    })

    // 构建日历天数
    const days = []
    // 填充空白
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: '', empty: true })
    }
    // 填充日期
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        day: d,
        date: dateStr,
        isToday: dateStr === this.data.today,
        hasTask: (taskMap[dateStr] || []).length > 0,
        taskCount: (taskMap[dateStr] || []).length
      })
    }

    this.setData({ days, taskMap })
  },

  // 上个月
  prevMonth() {
    let { year, month } = this.data
    month--
    if (month < 1) { month = 12; year-- }
    this.setData({ year, month })
    this.buildCalendar()
  },

  // 下个月
  nextMonth() {
    let { year, month } = this.data
    month++
    if (month > 12) { month = 1; year++ }
    this.setData({ year, month })
    this.buildCalendar()
  },

  // 选择日期
  selectDate(e) {
    const date = e.currentTarget.dataset.date
    if (!date) return
    this.setData({
      selectedDate: date,
      selectedTasks: this.data.taskMap[date] || []
    })
  }
})
