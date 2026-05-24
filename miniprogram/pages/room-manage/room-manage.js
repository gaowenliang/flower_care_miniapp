// pages/room-manage/room-manage.js
const storage = require('../../utils/storage')

const PRESET_ROOMS = ['阳台', '客厅', '卧室', '书房', '窗台', '花园']

Page({
  data: {
    rooms: [],
    showAddModal: false,
    newRoomName: '',
    // 编辑环境参数
    editingRoom: null,
    showEnvModal: false,
    envForm: { ventilation: '一般', lighting: '散射光', humidity: '适中', temperature: '常温' }
  },

  onShow() {
    this.loadRooms()
  },

  loadRooms() {
    let customRooms = []
    try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
    const roomEnvs = wx.getStorageSync('roomEnvs') || {}

    const rooms = [...PRESET_ROOMS, ...customRooms.filter(r => !PRESET_ROOMS.includes(r))].map(name => ({
      name,
      isPreset: PRESET_ROOMS.includes(name),
      env: roomEnvs[name] || null
    }))
    this.setData({ rooms })
  },

  // 添加房间
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

  // 删除房间
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

  // 环境参数
  editEnv(e) {
    const name = e.currentTarget.dataset.name
    const roomEnvs = wx.getStorageSync('roomEnvs') || {}
    const env = roomEnvs[name] || { ventilation: '一般', lighting: '散射光', humidity: '适中', temperature: '常温' }
    this.setData({
      showEnvModal: true,
      editingRoom: name,
      envForm: { ...env }
    })
  },

  onVentilationChange(e) { this.setData({ 'envForm.ventilation': e.detail.value }) },
  onLightingChange(e) { this.setData({ 'envForm.lighting': e.detail.value }) },
  onHumidityChange(e) { this.setData({ 'envForm.humidity': e.detail.value }) },
  onTemperatureChange(e) { this.setData({ 'envForm.temperature': e.detail.value }) },

  saveEnv() {
    const roomEnvs = wx.getStorageSync('roomEnvs') || {}
    roomEnvs[this.data.editingRoom] = { ...this.data.envForm }
    try { wx.setStorageSync('roomEnvs', roomEnvs) } catch (e) {}
    this.setData({ showEnvModal: false })
    this.loadRooms()
    wx.showToast({ title: '已保存', icon: 'none' })
  },

  hideEnvModal() { this.setData({ showEnvModal: false }) }
})
