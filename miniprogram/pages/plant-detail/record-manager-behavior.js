// pages/plant-detail/record-manager-behavior.js — 记录/日志相关逻辑
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const family = require('../../utils/family')
const imageUtil = require('../../utils/image')

module.exports = Behavior({
  methods: {
    takePhoto() {
      const exifDate = require('../../utils/exif-date')
      wx.chooseMedia({
        count: 9,
        mediaType: ['image'],
        sizeType: ['compressed'],
        success: async (res) => {
          const files = res.tempFiles
          wx.showLoading({ title: '上传中...' })

          let earliestPhotoDate = Infinity

          for (let i = 0; i < files.length; i++) {
            const tempFile = files[i]
            const photoUrl = await imageUtil.uploadImage(tempFile.tempFilePath)
            if (!photoUrl) continue

            let photoDate = Date.now() + i * 1000
            const isCamera = tempFile.sourceType === 'camera' || (res.sourceType && res.sourceType === 'camera')
            if (!isCamera) {
              const exifTs = await exifDate.getExifDate(tempFile.tempFilePath)
              if (exifTs && exifTs > 0) photoDate = exifTs + i * 1000
            }
            if (photoDate < earliestPhotoDate) earliestPhotoDate = photoDate

            if (this.data.isFamilyMode) {
              await family.addRecord({
                plantId: this.data.userPlant._id,
                type: 'photo',
                typeName: '拍照记录',
                note: '',
                photo: photoUrl,
                date: photoDate
              })
            } else {
              storage.addRecord({
                id: util.genId() + '_' + i,
                userPlantId: this.data.userPlant.id,
                type: 'photo',
                typeName: '拍照记录',
                date: photoDate,
                note: '',
                photo: photoUrl
              })
            }
          }

          wx.hideLoading()
          if (this.data.isFamilyMode) {
            await this.loadFamilyRecords()
            // 照片日期比 addedAt 更早，更新 addedAt
            if (earliestPhotoDate < Infinity && earliestPhotoDate < (this.data.userPlant.addedAt || Infinity)) {
              await family.updatePlant(this.data.userPlant._id, { addedAt: earliestPhotoDate })
            }
          } else {
            this.loadRecords()
            if (earliestPhotoDate < Infinity && earliestPhotoDate < (this.data.userPlant.addedAt || Infinity)) {
              storage.updatePlant(this.data.userPlant.id, { addedAt: earliestPhotoDate })
            }
          }
          wx.showToast({ title: `已记录${files.length}张 📷`, icon: 'none' })
        }
      })
    },

    addNote() {
      wx.showModal({
        title: '📝 记录一下',
        editable: true,
        placeholderText: '今天植物状态怎么样？',
        success: async (res) => {
          if (res.confirm && res.content) {
            if (this.data.isFamilyMode) {
              await family.addRecord({
                plantId: this.data.userPlant._id,
                type: 'note',
                typeName: '备注',
                note: res.content
              })
              await this.loadFamilyRecords()
            } else {
              storage.addRecord({
                id: util.genId(),
                userPlantId: this.data.userPlant.id,
                type: 'note',
                typeName: '备注',
                date: Date.now(),
                note: res.content
              })
              this.loadRecords()
            }
          }
        }
      })
    },

    // 跳转成长日记
    goJournal() {
      wx.navigateTo({ url: `/pages/plant-journal/plant-journal?id=${this.data.userPlant.id}` })
    },

    goDiagnose() {
      wx.navigateTo({ url: '/pages/diagnose/diagnose' })
    },

    // 跳转截图导入
    goImportScreenshot() {
      wx.navigateTo({ url: '/pages/import-screenshot/import-screenshot' })
    },

    retroCard() {
      const MAX_RETRO_PER_MONTH = 3
      const isFamilyMode = this.data.isFamilyMode

      // 计算本月已用补卡次数
      let retroUsed = 0
      const now = new Date()
      const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`
      if (isFamilyMode) {
        try {
          // 从云端记录统计本月补卡次数（避免多端竞态）
          const allRecords = family.getCachedRecords(this.data.userPlant._id || this.data.userPlant.id)
          retroUsed = allRecords.filter(r => r.type === 'retro' && r.date) .filter(r => {
            const d = new Date(r.date)
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
          }).length
        } catch (e) {}
      } else {
        retroUsed = MAX_RETRO_PER_MONTH - storage.getRetroRemaining()
      }
      const remaining = Math.max(0, MAX_RETRO_PER_MONTH - retroUsed)

      if (remaining <= 0) {
        wx.showToast({ title: '本月补卡次数已用完（3次/月）', icon: 'none', duration: 2500 })
        return
      }

      // 计算最近7天可补的日期
      const dates = []
      for (let i = 1; i <= 7; i++) {
        const d = new Date(now.getTime() - i * 86400000)
        d.setHours(0, 0, 0, 0)
        const dateStr = util.formatDate(d.getTime())
        const weekDay = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
        // 检查该天是否已有记录
        let existingRecords
        if (isFamilyMode) {
          existingRecords = family.getCachedRecords(this.data.userPlant._id || this.data.userPlant.id)
        } else {
          existingRecords = storage.getRecordsByPlant(this.data.userPlant.id)
        }
        const existing = existingRecords.find(r => util.formatDate(r.date) === dateStr)
        if (!existing) {
          dates.push({
            ts: d.getTime(),
            label: `${d.getMonth() + 1}/${d.getDate()} 周${weekDay}`,
            daysAgo: i
          })
        }
      }

      if (dates.length === 0) {
        wx.showToast({ title: '最近7天都有记录了~', icon: 'none' })
        return
      }

      wx.showActionSheet({
        alertText: `本月剩余 ${remaining} 次补卡`,
        itemList: dates.map(d => d.label + ` (${d.daysAgo}天前)`),
        success: (res) => {
          const selected = dates[res.tapIndex]
          wx.showModal({
            title: '确认补卡',
            content: `为 ${this.data.userPlant.nickname} 补 ${selected.label} 的养护记录？`,
            success: async (modalRes) => {
              if (modalRes.confirm) {
                if (isFamilyMode) {
                  // 家庭模式补卡：加记录到云端
                  try {
                    await family.addRecord({
                      plantId: this.data.userPlant._id || this.data.userPlant.id,
                      date: selected.ts + 12 * 3600000,
                      type: 'retro',
                      typeName: '补卡',
                      note: `补 ${selected.label} 养护记录`
                    })
                    wx.showToast({ title: '补卡成功 ✅', icon: 'none' })
                    this.loadFamilyRecords()
                  } catch (e) {
                    wx.showToast({ title: '补卡失败', icon: 'none' })
                  }
                } else {
                  const result = storage.retroCard(selected.ts, this.data.userPlant.id)
                  if (result.success) {
                    wx.showToast({ title: '补卡成功 ✅', icon: 'none' })
                    this.loadRecords()
                  } else {
                    wx.showToast({ title: result.reason, icon: 'none' })
                  }
                }
              }
            }
          })
        }
      })
    },

    // ========== 补浇水 ==========

    showRetroWaterModal() {
      this.setData({
        showRetroWater: true,
        retroWaterDate: '',
        retroWaterCustomDate: ''
      })
    },

    selectRetroWaterDate(e) {
      this.setData({
        retroWaterDate: e.currentTarget.dataset.date,
        retroWaterCustomDate: ''
      })
    },

    onRetroWaterCustomDate(e) {
      this.setData({
        retroWaterCustomDate: e.detail.value,
        retroWaterDate: ''
      })
    },

    async confirmRetroWater() {
      const selectedDate = this.data.retroWaterDate || this.data.retroWaterCustomDate
      if (!selectedDate) {
        wx.showToast({ title: '请选择日期', icon: 'none' })
        return
      }
      const ts = new Date(selectedDate + 'T12:00:00').getTime()
      if (isNaN(ts)) {
        wx.showToast({ title: '日期无效', icon: 'none' })
        return
      }
      this.setData({ showRetroWater: false })

      // 写入浇水记录
      if (this.data.isFamilyMode) {
        try {
          await family.addRecord({
            plantId: this.data.userPlant._id || this.data.userPlant.id,
            date: ts,
            type: 'water',
            typeName: '浇水',
            note: '补浇水'
          })
          // 更新浇水任务的 nextDate：从补浇水日期起算下一个周期
          await this._updateWaterTaskNextDate(ts)
          wx.showToast({ title: '已补浇水 💧', icon: 'none' })
          this.loadFamilyRecords()
          this.loadFamilyTasks()
          this.loadHealthScore()
        } catch (e) {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      } else {
        storage.addRecord({
          id: util.genId(),
          userPlantId: this.data.userPlant.id,
          type: 'water',
          typeName: '浇水',
          date: ts,
          note: '补浇水'
        })
        // 更新浇水任务的 nextDate
        this._updateWaterTaskNextDateLocal(ts)
        wx.showToast({ title: '已补浇水 💧', icon: 'none' })
        this.loadRecords()
        this.loadTasks()
        this.loadHealthScore()
      }
    },

    // 家庭模式：更新浇水任务 nextDate
    async _updateWaterTaskNextDate(waterDate) {
      const waterTask = this.data.tasks.find(t => t.type === 'water' && t.enabled)
      if (!waterTask) return
      const taskId = waterTask.id || waterTask._id
      const interval = waterTask.intervalDays || 7
      const nextDate = waterDate + interval * 86400000
      try {
        await family.updateTask(taskId, { nextDate, lastDoneDate: waterDate })
      } catch (e) {}
    },

    // 个人模式：更新浇水任务 nextDate
    _updateWaterTaskNextDateLocal(waterDate) {
      const allTasks = storage.getTasks()
      const waterTask = allTasks.find(t => t.type === 'water' && t.enabled && t.userPlantId === this.data.userPlant.id)
      if (!waterTask) return
      const interval = waterTask.intervalDays || 7
      waterTask.nextDate = waterDate + interval * 86400000
      waterTask.lastDoneDate = waterDate
      storage.saveTasks(allTasks)
    },

    cancelRetroWater() {
      this.setData({ showRetroWater: false, retroWaterDate: '', retroWaterCustomDate: '' })
    },

    // ========== 日期工具 ==========

    _getTodayStr() {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    },

    _buildRetroWaterDates() {
      const dates = []
      const now = new Date()
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      for (let i = 1; i <= 14; i++) {
        const d = new Date(now.getTime() - i * 86400000)
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        dates.push({
          value: dateStr,
          label: `${d.getMonth() + 1}月${d.getDate()}日`,
          week: weekDays[d.getDay()],
          daysAgo: i
        })
      }
      return dates
    },

    _formatArrivalDate(plant) {
      const ts = plant.addedAt
      if (!ts) return '未设置'
      const d = new Date(ts)
      const days = Math.floor((Date.now() - ts) / 86400000)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return `${dateStr}（${days}天）`
    },

    // ========== 删除记录 ==========

    toggleRecordMenu(e) {
      const recordId = e.currentTarget.dataset.id
      const records = this.data.records
      records.forEach(r => { r.showMenu = ((r._id || r.id) === recordId) ? !r.showMenu : false })
      this.setData({ records })
    },

    async deleteRecord(e) {
      const recordId = e.currentTarget.dataset.id
      const records = this.data.records
      const idx = records.findIndex(r => (r._id || r.id) === recordId)
      if (idx === -1) return
      const record = records[idx]

      wx.showModal({
        title: '删除记录',
        content: `确定删除「${record.typeName}」记录？`,
        confirmColor: '#e53935',
        success: async (res) => {
          if (!res.confirm) return
          if (this.data.isFamilyMode) {
            const result = await family.deleteRecord(recordId)
            if (!result.success) {
              wx.showToast({ title: result.error || '删除失败', icon: 'none' })
              return
            }
          } else {
            storage.deleteRecord(recordId)
          }
          const newRecords = this.data.records.filter(r => (r._id || r.id) !== recordId)
          this.setData({ records: newRecords }, () => { this.buildCalendar() })
          wx.showToast({ title: '已删除', icon: 'none' })
        }
      })
    }
  }
})
