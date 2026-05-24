// pages/room-manage/room-manage.js
const storage = require('../../utils/storage')

const PRESET_ROOMS = ['阳台', '客厅', '卧室', '书房', '窗台', '花园']

Page({
  data: {
    rooms: [],
    showAddModal: false,
    newRoomName: '',
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

    const rooms = [...PRESET_ROOMS, ...customRooms.filter(r => !PRESET_ROOMS.includes(r))].map(name => {
      const env = roomEnvs[name] || null
      return { name, isPreset: PRESET_ROOMS.includes(name), env }
    })
    this.setData({ rooms })
  },

  showAdd() { this.setData({ showAddModal: true, newRoomName: '' }) },
  hideAdd() { this.setData({ showAddModal: false }) },
  onNameInput(e) { this.setData({ newRoomName: e.detail.value }) },

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
    wx.showModal({
      title: '删除房间',
      content: `确定删除「${name}」？该房间下的植物不会被删除。`,
      confirmColor: '#e53935',
      success: (res) => {
        if (!res.confirm) return
        let customRooms = []
        try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
        customRooms = customRooms.filter(r => r !== name)
        try { wx.setStorageSync('customRooms', customRooms) } catch (e) {}
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

  hideEnvModal() { this.setData({ showEnvModal: false }) }
})
