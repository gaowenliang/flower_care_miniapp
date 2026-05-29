// pages/plant-journal/plant-journal.js - 植物成长日记（支持家庭模式）
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const imageUtil = require('../../utils/image')
const family = require('../../utils/family')

Page({
  data: {
    userPlant: null,
    journal: [],       // 成长日记列表
    previewImage: '',   // 预览大图
    compareMode: false, // 对比模式
    comparePhotos: [],  // 对比照片（最早、最晚）
    showPreview: false
  },

  onLoad(options) {
    const id = options.id
    this.setData({ isFamilyMode: family.isInFamily() })

    if (this.data.isFamilyMode) {
      const userPlant = family.getPlantById(id)
      if (!userPlant) {
        wx.showToast({ title: '植物不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1000)
        return
      }
      userPlant.id = userPlant._id || id
      this.setData({ userPlant })
    } else {
      const userPlant = storage.getPlantById(id)
      if (!userPlant) {
        wx.showToast({ title: '植物不存在', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1000)
        return
      }
      this.setData({ userPlant })
    }
  },

  onShow() {
    if (this.data.isFamilyMode) {
      this.loadFamilyJournal()
    } else {
      this.loadJournal()
    }
  },

  // 加载家庭日记
  async loadFamilyJournal() {
    const records = await family.getRecords(this.data.userPlant._id, 500)
    this.buildJournalFromRecords(records || [])
  },

  // 从记录构建日记
  buildJournalFromRecords(records) {
    const sorted = (records || []).sort((a, b) => b.date - a.date)
    const grouped = {}
    sorted.forEach(record => {
      record.id = record._id || record.id  // 兼容家庭模式
      const dateStr = util.formatDate(record.date)
      if (!grouped[dateStr]) {
        grouped[dateStr] = { date: dateStr, maxTs: record.date, dateLabel: this.getDateLabel(record.date), weekday: this.getWeekday(record.date), photos: [], notes: [] }
      }
      if (record.date > grouped[dateStr].maxTs) grouped[dateStr].maxTs = record.date
      if (record.type === 'photo' && record.photo) {
        grouped[dateStr].photos.push({ ...record, time: this.formatTime(record.date) })
      } else if ((record.type === 'note' || record.note) && record.note) {
        grouped[dateStr].notes.push({ ...record, time: this.formatTime(record.date) })
      }
    })
    const journal = Object.values(grouped).filter(g => g.photos.length > 0 || g.notes.length > 0).sort((a, b) => b.maxTs - a.maxTs)
    const allPhotos = sorted.filter(r => r.type === 'photo' && r.photo).sort((a, b) => a.date - b.date)
    const comparePhotos = []
    if (allPhotos.length >= 2) {
      comparePhotos.push({ photo: allPhotos[0].photo, date: allPhotos[0].date, label: '最初' })
      comparePhotos.push({ photo: allPhotos[allPhotos.length - 1].photo, date: allPhotos[allPhotos.length - 1].date, label: '最近' })
    }
    this.setData({ journal, comparePhotos })
  },

  // 加载成长日记（个人模式）
  loadJournal() {
    const records = storage.getRecordsByPlant(this.data.userPlant.id)
    
    // 按日期分组所有记录（照片+备注）
    const sorted = records.sort((a, b) => b.date - a.date)

    const grouped = {}
    sorted.forEach(record => {
      const dateStr = util.formatDate(record.date)
      if (!grouped[dateStr]) {
        grouped[dateStr] = {
          date: dateStr,
          maxTs: record.date,
          dateLabel: this.getDateLabel(record.date),
          weekday: this.getWeekday(record.date),
          photos: [],
          notes: []
        }
      }
      if (record.type === 'photo' && record.photo) {
        grouped[dateStr].photos.push({ ...record, time: this.formatTime(record.date) })
      } else if (record.type === 'note' && record.note) {
        grouped[dateStr].notes.push({ ...record, time: this.formatTime(record.date) })
      }
      if (record.date > grouped[dateStr].maxTs) grouped[dateStr].maxTs = record.date
    })

    const journal = Object.values(grouped)
      .filter(g => g.photos.length > 0 || g.notes.length > 0)
      .sort((a, b) => b.maxTs - a.maxTs)

    // 成长对比：找最早和最新的照片
    const allPhotos = records.filter(r => r.type === 'photo' && r.photo).sort((a, b) => a.date - b.date)
    const comparePhotos = []
    if (allPhotos.length >= 2) {
      comparePhotos.push({ photo: allPhotos[0].photo, date: allPhotos[0].date, label: '最初' })
      comparePhotos.push({ photo: allPhotos[allPhotos.length - 1].photo, date: allPhotos[allPhotos.length - 1].date, label: '最近' })
    }

    this.setData({ journal, comparePhotos })
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
  async takePhoto() {
    const exifDate = require('../../utils/exif-date')
    wx.chooseMedia({
      count: 9, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'],
      success: async (res) => {
        const files = res.tempFiles
        wx.showLoading({ title: '上传中...' })

        // 找出最早的照片日期，用于更新 addedAt
        let earliestPhotoDate = Infinity

        if (this.data.isFamilyMode) {
          for (let i = 0; i < files.length; i++) {
            const photoUrl = await imageUtil.uploadImage(files[i].tempFilePath)
            if (!photoUrl) continue
            let photoDate = Date.now() + i
            const exifTs = await exifDate.getExifDate(files[i].tempFilePath)
            if (exifTs && exifTs > 0) photoDate = exifTs + i
            if (photoDate < earliestPhotoDate) earliestPhotoDate = photoDate
            await family.addRecord({
              plantId: this.data.userPlant._id,
              type: 'photo',
              typeName: '拍照记录',
              note: '',
              photo: photoUrl,
              date: photoDate
            })
          }
          wx.hideLoading()
          this.loadFamilyJournal()
          // 如果照片日期比 addedAt 更早，更新 addedAt
          if (earliestPhotoDate < Infinity && earliestPhotoDate < (this.data.userPlant.addedAt || Infinity)) {
            await family.updatePlant(this.data.userPlant._id, { addedAt: earliestPhotoDate })
          }
          wx.showToast({ title: `已记录${files.length}张 📷`, icon: 'none' })
          return
        }

        // 个人模式
        const promises = files.map(async (file, index) => {
          const photoUrl = await imageUtil.uploadImage(file.tempFilePath)
          if (!photoUrl) return null
          let photoDate = Date.now() + index
          const exifTs = await exifDate.getExifDate(file.tempFilePath)
          if (exifTs && exifTs > 0) photoDate = exifTs + index
          if (photoDate < earliestPhotoDate) earliestPhotoDate = photoDate
          const record = { id: util.genId() + '_' + index, userPlantId: this.data.userPlant.id, type: 'photo', typeName: '拍照记录', date: photoDate, note: '', photo: photoUrl, size: file.size }
          storage.addRecord(record)
          return record
        })
        Promise.all(promises).then(() => {
          wx.hideLoading()
          this.loadJournal()
          // 如果照片日期比 addedAt 更早，更新 addedAt
          if (earliestPhotoDate < Infinity && earliestPhotoDate < (this.data.userPlant.addedAt || Infinity)) {
            storage.updatePlant(this.data.userPlant.id, { addedAt: earliestPhotoDate })
          }
          wx.showToast({ title: `已记录${files.length}张 📷`, icon: 'none' })
        })
      }
    })
  },

  // 添加文字备注
  async addNote() {
    wx.showModal({
      title: '📝 记录一下', editable: true, placeholderText: '今天植物状态怎么样？',
      success: async (res) => {
        if (res.confirm && res.content) {
          if (this.data.isFamilyMode) {
            await family.addRecord({ plantId: this.data.userPlant._id, type: 'note', typeName: '备注', note: res.content })
            this.loadFamilyJournal()
          } else {
            storage.addRecord({ id: util.genId(), userPlantId: this.data.userPlant.id, type: 'note', typeName: '备注', date: Date.now(), note: res.content })
            this.loadJournal()
          }
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

  // 长按删除 → 改为点击展开菜单
  toggleJournalMenu(e) {
    const targetId = e.currentTarget.dataset.id
    const journal = this.data.journal.map(group => ({
      ...group,
      photos: group.photos.map(p => ({
        ...p,
        showMenu: p.id === targetId ? !p.showMenu : false
      })),
      notes: group.notes.map(n => ({
        ...n,
        showMenu: n.id === targetId ? !n.showMenu : false
      }))
    }))
    this.setData({ journal })
  },

  async deleteRecord(e) {
    // 兼容家庭模式(_id)和个人模式(id)
    const recordId = e.currentTarget.dataset.id || e.currentTarget.dataset._id
    wx.showModal({
      title: '删除记录', content: '确定删除这条记录吗？', confirmColor: '#2E7D32',
      success: async (res) => {
        if (res.confirm) {
          if (this.data.isFamilyMode) {
            await family.deleteRecord(recordId)
            this.loadFamilyJournal()
          } else {
            storage.deleteRecord(recordId)
            this.loadJournal()
          }
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
