// pages/room-manage/room-manage.js
const storage = require('../../utils/storage')

const PRESET_ROOMS = ['阳台', '客厅', '卧室', '书房', '窗台', '花园']

Page({
  data: {
    rooms: [],
    showAddModal: false,
    newRoomName: '',
    showRenameModal: false,
    renameInput: '',
    renameOldName: '',
    editingRoom: null,
    showEnvModal: false,
    // 当前选中文字
    ventilation: '一般',
    lighting: '散射光',
    humidity: '适中',
    temperature: '常温'
  },

  onShow() {
    this.loadRooms()
  },

  loadRooms() {
    let customRooms = []
    try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
    const roomEnvs = wx.getStorageSync('roomEnvs') || {}
    // 被重命名的预设房间，不再显示原名
    const renamedFrom = wx.getStorageSync('renamedPresets') || {}
    const hiddenPresets = new Set(Object.keys(renamedFrom))

    const rooms = [...PRESET_ROOMS.filter(r => !hiddenPresets.has(r)), ...customRooms.filter(r => !PRESET_ROOMS.includes(r) || hiddenPresets.has(r))].map(name => {
      const env = roomEnvs[name] || null
      return { name, isPreset: false, env }
    })
    this.setData({ rooms })
  },

  showAdd() { this.setData({ showAddModal: true, newRoomName: '' }) },
  hideAdd() { this.setData({ showAddModal: false }) },
  onNameInput(e) { this.setData({ newRoomName: e.detail.value }) },

  // ========== 重命名 ==========
  showRename(e) {
    const name = e.currentTarget.dataset.name
    this.setData({ showRenameModal: true, renameInput: name, renameOldName: name })
  },
  hideRename() { this.setData({ showRenameModal: false }) },
  onRenameInput(e) { this.setData({ renameInput: e.detail.value }) },

  confirmRename() {
    const newName = this.data.renameInput.trim()
    const oldName = this.data.renameOldName
    if (!newName) { wx.showToast({ title: '请输入名称', icon: 'none' }); return }
    if (newName.length > 6) { wx.showToast({ title: '最多6个字', icon: 'none' }); return }
    if (newName === oldName) { this.setData({ showRenameModal: false }); return }

    // 检查重名
    const allNames = this.data.rooms.map(r => r.name)
    if (allNames.includes(newName)) { wx.showToast({ title: '该房间已存在', icon: 'none' }); return }

    // 更新自定义房间列表
    let customRooms = []
    try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
    const isPreset = PRESET_ROOMS.includes(oldName)
    if (isPreset) {
      // 预设房间改名：隐藏原名，加新名到自定义
      let renamedPresets = wx.getStorageSync('renamedPresets') || {}
      renamedPresets[oldName] = newName
      try { wx.setStorageSync('renamedPresets', renamedPresets) } catch (e) {}
      if (!customRooms.includes(newName)) customRooms.push(newName)
      try { wx.setStorageSync('customRooms', customRooms) } catch (e) {}
    } else {
      const idx = customRooms.indexOf(oldName)
      if (idx >= 0) customRooms[idx] = newName
      try { wx.setStorageSync('customRooms', customRooms) } catch (e) {}
    }

    // 迁移环境参数
    const roomEnvs = wx.getStorageSync('roomEnvs') || {}
    if (roomEnvs[oldName]) {
      roomEnvs[newName] = roomEnvs[oldName]
      delete roomEnvs[oldName]
      try { wx.setStorageSync('roomEnvs', roomEnvs) } catch (e) {}
    }

    // 更新该房间下的植物
    const garden = storage.getGarden()
    let changed = 0
    garden.forEach(p => {
      if (p.location === oldName) { p.location = newName; changed++ }
    })
    if (changed > 0) storage.saveGarden(garden)

    this.setData({ showRenameModal: false })
    this.loadRooms()
    wx.showToast({ title: changed > 0 ? `已改名，${changed}棵植物已迁移` : '已改名', icon: 'none' })
  },

  confirmAdd() {
    const name = this.data.newRoomName.trim()
    if (!name) { wx.showToast({ title: '请输入房间名', icon: 'none' }); return }
    if (name.length > 6) { wx.showToast({ title: '最多6个字', icon: 'none' }); return }
    let customRooms = []
    try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
    if (customRooms.includes(name) || PRESET_ROOMS.includes(name)) {
      wx.showToast({ title: '该房间已存在', icon: 'none' }); return
    }
    customRooms.push(name)
    try { wx.setStorageSync('customRooms', customRooms) } catch (e) {}
    this.setData({ showAddModal: false })
    this.loadRooms()
    wx.showToast({ title: '已添加', icon: 'none' })
  },

  deleteRoom(e) {
    const name = e.currentTarget.dataset.name
    const isPreset = e.currentTarget.dataset.preset
    wx.showModal({
      title: '删除房间',
      content: `确定删除「${name}」？该房间下的植物将移到「阳台」。`,
      confirmColor: '#e53935',
      success: (res) => {
        if (!res.confirm) return

        // 从自定义列表删除
        let customRooms = []
        try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
        customRooms = customRooms.filter(r => r !== name)
        try { wx.setStorageSync('customRooms', customRooms) } catch (e) {}

        // 清理重命名映射
        let renamedPresets = wx.getStorageSync('renamedPresets') || {}
        // 如果删除的是改名后的房间，恢复原预设
        for (const [old, renamed] of Object.entries(renamedPresets)) {
          if (renamed === name) { delete renamedPresets[old]; break }
        }
        try { wx.setStorageSync('renamedPresets', renamedPresets) } catch (e) {}

        // 删环境参数
        const roomEnvs = wx.getStorageSync('roomEnvs') || {}
        delete roomEnvs[name]
        try { wx.setStorageSync('roomEnvs', roomEnvs) } catch (e) {}

        // 该房间的植物移到阳台
        const garden = storage.getGarden()
        garden.forEach(p => {
          if (p.location === name) p.location = '阳台'
        })
        storage.saveGarden(garden)

        this.loadRooms()
        wx.showToast({ title: '已删除', icon: 'none' })
      }
    })
  },

  editEnv(e) {
    const name = e.currentTarget.dataset.name
    const roomEnvs = wx.getStorageSync('roomEnvs') || {}
    const saved = roomEnvs[name]
    this.setData({
      showEnvModal: true,
      editingRoom: name,
      ventilation: saved ? saved.ventilation : '一般',
      lighting: saved ? saved.lighting : '散射光',
      humidity: saved ? saved.humidity : '适中',
      temperature: saved ? saved.temperature : '常温'
    })
  },

  onVentilationChange(e) { this.setData({ ventilation: e.detail.value }) },
  onLightingChange(e) { this.setData({ lighting: e.detail.value }) },
  onHumidityChange(e) { this.setData({ humidity: e.detail.value }) },
  onTemperatureChange(e) { this.setData({ temperature: e.detail.value }) },

  setEnv(e) {
    const key = e.currentTarget.dataset.key
    const val = e.currentTarget.dataset.val
    this.setData({ [key]: val })
  },

  saveEnv() {
    const roomEnvs = wx.getStorageSync('roomEnvs') || {}
    roomEnvs[this.data.editingRoom] = {
      ventilation: this.data.ventilation,
      lighting: this.data.lighting,
      humidity: this.data.humidity,
      temperature: this.data.temperature
    }
    try { wx.setStorageSync('roomEnvs', roomEnvs) } catch (e) {}
    this.setData({ showEnvModal: false })
    this.loadRooms()
    wx.showToast({ title: '已保存', icon: 'none' })
  },

  hideEnvModal() { this.setData({ showEnvModal: false }) },
  preventBubble() {}
})
