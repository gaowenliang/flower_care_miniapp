// pages/plant-detail/plant-editor-behavior.js — 编辑操作相关逻辑
const storage = require('../../utils/storage')
const family = require('../../utils/family')
const imageUtil = require('../../utils/image')

function _timer(page, fn, delay) {
  const id = setTimeout(fn, delay)
  page.data._timers.push(id)
  return id
}

module.exports = Behavior({
  methods: {
    // 编辑昵称
    editNickname() {
      wx.showModal({
        title: '修改昵称',
        editable: true,
        placeholderText: this.data.userPlant.nickname,
        success: async (res) => {
          if (res.confirm && res.content && res.content.trim()) {
            const nickname = res.content.trim()
            if (this.data.isFamilyMode) {
              await family.updatePlant(this.data.userPlant._id, { nickname })
            } else {
              storage.updatePlant(this.data.userPlant.id, { nickname })
            }
            this.setData({ 'userPlant.nickname': nickname })
            wx.showToast({ title: '已修改', icon: 'none' })
          }
        }
      })
    },

    // 编辑位置
    editLocation() {
      if (this.data.loading) return
      const rooms = ['阳台', '客厅', '卧室', '书房', '窗台', '花园']
      try {
        const custom = wx.getStorageSync('customRooms') || []
        custom.forEach(r => { if (!rooms.includes(r)) rooms.push(r) })
      } catch (e) {}
      this.setData({ showRoomModal: true, roomList: rooms, selectedRoom: this.data.userPlant.location || rooms[0] })
    },

    selectRoom(e) {
      this.setData({ selectedRoom: e.currentTarget.dataset.room })
    },

    onRoomInput(e) {
      this.setData({ customRoomInput: e.detail.value })
    },

    async confirmRoom() {
      const room = this.data.customRoomInput || this.data.selectedRoom
      if (!room) return
      this.setData({ showRoomModal: false, customRoomInput: '' })
      if (this.data.isFamilyMode) {
        await family.updatePlant(this.data.userPlant._id, { location: room })
      } else {
        storage.updatePlant(this.data.userPlant.id, { location: room })
      }
      this.setData({ 'userPlant.location': room })
      wx.showToast({ title: '已修改', icon: 'none' })
    },

    cancelRoom() {
      this.setData({ showRoomModal: false, customRoomInput: '' })
    },

    editPrice() {
      if (this.data.loading) return
      this.setData({
        showPriceModal: true,
        priceInput: this.data.userPlant.purchasePrice ? String(this.data.userPlant.purchasePrice) : '',
        sourceInput: this.data.userPlant.purchaseSource || ''
      })
    },

    onPriceInput(e) { this.setData({ priceInput: e.detail.value }) },
    onSourceInput(e) { this.setData({ sourceInput: e.detail.value }) },

    selectSource(e) {
      this.setData({ sourceInput: e.currentTarget.dataset.source })
    },

    async confirmPrice() {
      const price = Math.round((parseFloat(this.data.priceInput) || 0) * 100) / 100
      const source = this.data.sourceInput
      this.setData({ showPriceModal: false })
      const updates = { purchasePrice: price }
      if (source) updates.purchaseSource = source
      if (this.data.isFamilyMode) {
        await family.updatePlant(this.data.userPlant._id, updates)
      } else {
        storage.updatePlant(this.data.userPlant.id, updates)
      }
      this.setData({ 'userPlant.purchasePrice': price, 'userPlant.purchaseSource': source })
      wx.showToast({ title: price > 0 ? '已设置' : '已清除', icon: 'none' })
    },

    cancelPrice() {
      this.setData({ showPriceModal: false })
    },

    // ========== 到家日期 ==========

    editArrivalDate() {
      const ts = this.data.userPlant.addedAt
      const d = ts ? new Date(ts) : new Date()
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      this.setData({ showArrivalDateModal: true, arrivalDateInput: dateStr, todayStr })
    },

    onArrivalDateChange(e) {
      this.setData({ arrivalDateInput: e.detail.value })
    },

    async confirmArrivalDate() {
      const dateStr = this.data.arrivalDateInput
      if (!dateStr) return
      const ts = new Date(dateStr + 'T00:00:00').getTime()
      if (isNaN(ts)) { wx.showToast({ title: '日期无效', icon: 'none' }); return }
      this.setData({ showArrivalDateModal: false })

      if (this.data.isFamilyMode) {
        await family.updatePlant(this.data.userPlant._id, { addedAt: ts })
      } else {
        const plant = storage.getGarden().find(p => p.id === this.data.userPlant.id)
        if (plant) { plant.addedAt = ts; storage.saveGarden() }
      }
      this.setData({
        'userPlant.addedAt': ts,
        arrivalDateText: this._formatArrivalDate({ addedAt: ts })
      })
      wx.showToast({ title: '已更新', icon: 'none' })
    },

    cancelArrivalDate() {
      this.setData({ showArrivalDateModal: false })
    },

    // ========== 标记死亡 / 删除 / 头像 ==========

    markDead() {
      const isDead = this.data.userPlant.dead
      const action = isDead ? '复活' : '标记嘎了'
      const content = isDead ? `让${this.data.userPlant.nickname}复活？` : `确认${this.data.userPlant.nickname}嘎了？\n将停止所有养护提醒`

      wx.showModal({
        title: action, content, confirmColor: isDead ? '#4CAF50' : '#e53935',
        success: async (res) => {
          if (!res.confirm) return
          const updates = {}

          if (!isDead) {
            // 标记嘎了：记住原房间、移到💀天堂、停任务
            updates.dead = true
            updates.deadAt = Date.now()
            updates._prevLocation = this.data.userPlant.location
            updates.location = '💀 天堂'
          } else {
            // 复活：恢复原房间
            updates.dead = false
            updates.location = this.data.userPlant._prevLocation || '阳台'
            delete updates._prevLocation
          }

          // 更新本地显示
          const up = { ...this.data.userPlant, ...updates }
          this.setData({ userPlant: up })

          // 保存
          const plantId = this.data.userPlant._id || this.data.userPlant.id
          if (this.data.isFamilyMode && plantId) {
            try {
              await family.updatePlant(plantId, updates)
              // 家庭模式：停用/启用任务
              const tasks = await family.getTasks(plantId)
              const togglePromises = (tasks || [])
                .filter(t => (!isDead && t.enabled) || (isDead && !t.enabled))
                .map(t => family.toggleTask(t._id || t.id))
              await Promise.all(togglePromises)
              await family.getPlants(true)
            } catch (e) {
              wx.showToast({ title: '保存失败', icon: 'none' }); return
            }
          } else {
            storage.updatePlant(this.data.userPlant.id, updates)
            // 个人模式：停用/启用任务
            const tasks = storage.getTasksByPlant(this.data.userPlant.id)
            tasks.forEach(t => {
              if (!isDead && t.enabled) storage.toggleTask(t.id)
              else if (isDead && !t.enabled) storage.toggleTask(t.id)
            })
          }

          wx.showToast({ title: isDead ? '复活了! 🌱' : '已标记 💀', icon: 'none' })
        }
      })
    },

    deletePlant() {
      wx.showModal({
        title: '确认删除',
        content: `确定要把 ${this.data.userPlant.nickname} 从花园移除吗？`,
        confirmColor: '#2E7D32',
        success: async (res) => {
          if (res.confirm) {
            if (this.data.isFamilyMode) {
              wx.showLoading({ title: '删除中...' })
              const result = await family.removePlant(this.data.userPlant._id)
              wx.hideLoading()
              if (result.success) {
                wx.showToast({ title: '已删除', icon: 'none' })
                _timer(this, () => wx.navigateBack(), 1000)
              } else {
                wx.showToast({ title: result.error || '删除失败', icon: 'none' })
              }
              return
            }

            // 个人模式
            const backup = {
              plant: JSON.parse(JSON.stringify(this.data.userPlant)),
              tasks: storage.getTasksByPlant(this.data.userPlant.id),
              records: storage.getRecordsByPlant(this.data.userPlant.id)
            }
            storage.removePlant(this.data.userPlant.id)

            const pages = getCurrentPages()
            const prevPage = pages.length >= 2 ? pages[pages.length - 2] : null
            if (prevPage && prevPage.onShow) prevPage.onShow()
            wx.showToast({ title: '已删除', icon: 'none', duration: 3000 })

            this._deleteBackup = backup
            _timer(this, () => { this._deleteBackup = null }, 5000)

            _timer(this, () => wx.navigateBack(), 1000)
          }
        }
      })
    },

    // 修改植物头像
    changeAvatar() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: async (res) => {
          const photoUrl = await imageUtil.uploadSquareAvatar(res.tempFiles[0].tempFilePath)
          if (!photoUrl) {
            wx.showToast({ title: '图片上传失败', icon: 'none' })
            return
          }
          if (this.data.isFamilyMode) {
            await family.updatePlant(this.data.userPlant._id, { avatar: photoUrl })
            family.getPlants(true).catch(() => {})
          } else {
            storage.updatePlant(this.data.userPlant.id, { avatar: photoUrl })
          }
          this.setData({ 'userPlant.avatar': photoUrl })
          wx.showToast({ title: '头像已更新', icon: 'none' })
        }
      })
    },

    onAvatarError() {
      this.setData({ 'userPlant.avatar': '' })
    },

    // ========== 认养 ==========

    async toggleAdopt() {
      const result = await family.toggleAdopt(this.data.userPlant._id)
      if (result.success) {
        const adopted = result.adopted
        this.setData({ isAdoptedByMe: adopted })
        // 刷新认养者列表
        const plant = family.getPlantById(this.data.userPlant._id)
        if (plant) {
          this.setData({ adopterNames: family.getAdopterNames(plant) })
        }
        wx.showToast({ title: adopted ? '已认养 💚' : '已取消认养', icon: 'none' })
      } else {
        wx.showToast({ title: result.error || '操作失败', icon: 'none' })
      }
    }
  }
})
