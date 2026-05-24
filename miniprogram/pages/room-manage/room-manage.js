// pages/room-manage/room-manage.js
const storage = require('../../utils/storage')

const PRESET_ROOMS = ['阳台', '客厅', '卧室', '书房', '窗台', '花园']
const ENV_OPTIONS = {
  ventilation: ['极差', '差', '一般', '良好', '极佳'],
  lighting: ['阴暗', '弱光', '散射光', '明亮', '强光'],
  humidity: ['极干', '干燥', '适中', '潮湿', '极潮'],
  temperature: ['寒冷', '偏凉', '常温', '温暖', '炎热']
}
const ENV_DEFAULT = { ventilation: 2, lighting: 2, humidity: 2, temperature: 2 }

Page({
  data: {
    rooms: [],
    showAddModal: false,
    newRoomName: '',
    editingRoom: null,
    showEnvModal: false,
    envForm: { ...ENV_DEFAULT },
    // 选项数据
    ventilationOptions: ENV_OPTIONS.ventilation,
    lightingOptions: ENV_OPTIONS.lighting,
    humidityOptions: ENV_OPTIONS.humidity,
    temperatureOptions: ENV_OPTIONS.temperature
  },

  onShow() {
    this.loadRooms()
  },

  loadRooms() {
    let customRooms = []
    try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
    const roomEnvs = wx.getStorageSync('roomEnvs') || {}

    const rooms = [...PRESET_ROOMS, ...customRooms.filter(r => !PRESET_ROOMS.includes(r))].map(name => {
      const envRaw = roomEnvs[name]
      const env = envRaw ? {
        ventilation: ENV_OPTIONS.ventilation[envRaw.ventilation] || '',
        lighting: ENV_OPTIONS.lighting[envRaw.lighting] || '',
        humidity: ENV_OPTIONS.humidity[envRaw.humidity] || '',
        temperature: ENV_OPTIONS.temperature[envRaw.temperature] || ''
      } : null
      return { name, isPreset: PRESET_ROOMS.includes(name), env }
    })
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
    const saved = roomEnvs[name] || null
    this.setData({
      showEnvModal: true,
      editingRoom: name,
      envForm: saved ? { ...saved } : { ...ENV_DEFAULT }
    })
  },

  onVentilationChange(e) { this.setData({ 'envForm.ventilation': Number(e.detail.value) }) },
  onLightingChange(e) { this.setData({ 'envForm.lighting': Number(e.detail.value) }) },
  onHumidityChange(e) { this.setData({ 'envForm.humidity': Number(e.detail.value) }) },
  onTemperatureChange(e) { this.setData({ 'envForm.temperature': Number(e.detail.value) }) },

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
