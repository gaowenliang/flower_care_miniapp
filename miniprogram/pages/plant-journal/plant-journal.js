// pages/plant-journal/plant-journal.js - 植物成长日记
const util = require('../../utils/util')
const storage = require('../../utils/storage')

Page({
  data: {
    userPlant: null,
    journal: [],       // 成长日记列表
    previewImage: '',   // 预览大图
    showPreview: false
  },

  onLoad(options) {
    const id = options.id
    const userPlant = storage.getPlantById(id)
    if (!userPlant) {
      wx.showToast({ title: '植物不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }
    this.setData({ userPlant })
  },

  onShow() {
    this.loadJournal()
  },

  // 加载成长日记
  loadJournal() {
    const records = storage.getRecordsByPlant(this.data.userPlant.id)
    
    // 只取拍照记录，按日期分组
    const photoRecords = records
      .filter(r => r.type === 'photo' && r.photo)
      .sort((a, b) => b.date - a.date)

    // 按日期分组
    const grouped = {}
    photoRecords.forEach(record => {
      const dateStr = util.formatDate(record.date)
      if (!grouped[dateStr]) {
        grouped[dateStr] = {
          date: dateStr,
          dateLabel: this.getDateLabel(record.date),
          weekday: this.getWeekday(record.date),
          time: this.formatTime(record.date),
          records: []
        }
      }
      grouped[dateStr].records.push(record)
    })

    const journal = Object.values(grouped).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    )

    this.setData({ journal })
  },

  // 日期标签
  getDateLabel(date) {
    const now = new Date()
    const d = new Date(date)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diff = (today - target) / 86400000

    if (diff === 0) return '今天'
    if (diff === 1) return '昨天'
    if (diff === 2) return '前天'
    if (diff < 7) return `${diff}天前`
    if (diff < 30) return `${Math.floor(diff / 7)}周前`
    return `${d.getMonth() + 1}月${d.getDate()}日`
  },

  // 星期
  getWeekday(date) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return days[new Date(date).getDay()]
  },

  // 格式化时间 HH:mm
  formatTime(date) {
    const d = new Date(date)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  },

  // 拍照记录
  takePhoto() {
    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const files = res.tempFiles
        const promises = files.map((file, index) => {
          return new Promise((resolve) => {
            const record = {
              id: util.genId() + '_' + index,
              userPlantId: this.data.userPlant.id,
              type: 'photo',
              typeName: '拍照记录',
              date: Date.now() + index, // 保证排序唯一
              note: '',
              photo: file.tempFilePath,
              size: file.size
            }
            storage.addRecord(record)
            resolve(record)
          })
        })

        Promise.all(promises).then(() => {
          this.loadJournal()
          wx.showToast({ title: `已记录${files.length}张 📷`, icon: 'none' })
        })
      }
    })
  },

  // 添加文字备注
  addNote() {
    wx.showModal({
      title: '📝 记录一下',
      editable: true,
      placeholderText: '今天植物状态怎么样？',
      success: (res) => {
        if (res.confirm && res.content) {
          storage.addRecord({
            id: util.genId(),
            userPlantId: this.data.userPlant.id,
            type: 'note',
            typeName: '备注',
            date: Date.now(),
            note: res.content
          })
          this.loadJournal()
          wx.showToast({ title: '已记录', icon: 'none' })
        }
      }
    })
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    this.setData({ previewImage: url, showPreview: true })
  },

  // 关闭预览
  closePreview() {
    this.setData({ showPreview: false })
  },

  // 长按删除
  deleteRecord(e) {
    const recordId = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条记录吗？',
      confirmColor: '#FF7043',
      success: (res) => {
        if (res.confirm) {
          storage.deleteRecord(recordId)
          this.loadJournal()
          wx.showToast({ title: '已删除', icon: 'none' })
        }
      }
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `${this.data.userPlant.nickname}的成长日记`,
      path: '/pages/index/index'
    }
  }
})
