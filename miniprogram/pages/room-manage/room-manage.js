// pages/room-manage/room-manage.js
const family = require('../../utils/family')

const { PRESET_ROOMS } = require('../../utils/rooms')

// 工具函数：安全读写 customRooms
function getCustomRooms() {
  try { return wx.getStorageSync('customRooms') || [] } catch (e) { return [] }
}
function setCustomRooms(rooms) {
  try { wx.setStorageSync('customRooms', rooms) } catch (e) {}
}

// 获取可用的默认迁移目标房间
// 优先改名后的阳台→原名阳台→第一个没改名的预设→第一个改名后的名字→第一个自定义
function getDefaultMigrationTarget() {
  const renamedPresets = (() => { try { return wx.getStorageSync('renamedPresets') || {} } catch (e) { return {} } })()
  const customRooms = getCustomRooms()
  // 如果阳台被改名了，用改名后的名字
  if (renamedPresets['阳台']) return renamedPresets['阳台']
  // 阳台没改名就用阳台
  if (!renamedPresets['阳台']) return '阳台'
  // 所有预设都被改名了，找第一个没被改名的预设
  for (const room of PRESET_ROOMS) {
    if (!renamedPresets[room]) return room
  }
  // 所有预设都被改名了，用第一个改名后的名字
  const vals = Object.values(renamedPresets)
  if (vals.length > 0) return vals[0]
  // 最后兜底：第一个自定义房间
  if (customRooms.length > 0) return customRooms[0]
  return '阳台'
}

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
    const customRooms = getCustomRooms()
    const roomEnvs = (() => { try { return wx.getStorageSync('roomEnvs') || {} } catch (e) { return {} } })()
    // 被重命名的预设房间，不再显示原名
    const renamedFrom = (() => { try { return wx.getStorageSync('renamedPresets') || {} } catch (e) { return {} } })()
    const hiddenPresets = new Set(Object.keys(renamedFrom))

    const rooms = [...PRESET_ROOMS.filter(r => !hiddenPresets.has(r)), ...customRooms.filter(r => !PRESET_ROOMS.includes(r) || hiddenPresets.has(r))].map(name => {
      const env = roomEnvs[name] || null
      return { name, isPreset: PRESET_ROOMS.includes(name) && !hiddenPresets.has(name), env }
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

  async confirmRename() {
    const newName = this.data.renameInput.trim()
    const oldName = this.data.renameOldName
    if (!newName) { wx.showToast({ title: '请输入名称', icon: 'none' }); return }
    if (newName.length > 6) { wx.showToast({ title: '最多6个字', icon: 'none' }); return }
    if (newName === oldName) { this.setData({ showRenameModal: false }); return }

    // 检查重名
    const allNames = this.data.rooms.map(r => r.name)
    if (allNames.includes(newName)) { wx.showToast({ title: '该房间已存在', icon: 'none' }); return }

    // 更新自定义房间列表
    let customRooms = getCustomRooms()
    const isPreset = PRESET_ROOMS.includes(oldName)
    if (isPreset) {
      let renamedPresets = (() => { try { return wx.getStorageSync('renamedPresets') || {} } catch (e) { return {} } })()
      renamedPresets[oldName] = newName
      try { wx.setStorageSync('renamedPresets', renamedPresets) } catch (e) {}
      if (!customRooms.includes(newName)) customRooms.push(newName)
      setCustomRooms(customRooms)
    } else {
      const idx = customRooms.indexOf(oldName)
      if (idx >= 0) customRooms[idx] = newName
      setCustomRooms(customRooms)
    }

    // 迁移环境参数
    const roomEnvs = (() => { try { return wx.getStorageSync('roomEnvs') || {} } catch (e) { return {} } })()
    if (roomEnvs[oldName]) {
      roomEnvs[newName] = roomEnvs[oldName]
      delete roomEnvs[oldName]
      try { wx.setStorageSync('roomEnvs', roomEnvs) } catch (e) {}
    }

    // 先乐观更新本地缓存
    const plants = family.getCachedPlants()
    const plantsToMove = plants.filter(p => p.location === oldName)
    for (const p of plantsToMove) {
      family.updatePlant(p._id, { location: newName, _prevLocation: oldName })
    }

    // 云端迁移 — 串行写入避免并发冲突
    if (plantsToMove.length > 0) {
      wx.showLoading({ title: '迁移中...' })
      let changed = 0
      for (const p of plantsToMove) {
        try {
          await family.updatePlant(p._id, { location: newName })
          changed++
        } catch (e) { console.error('迁移植物失败:', p._id, e) }
      }
      wx.hideLoading()
      this.setData({ showRenameModal: false })
      this.loadRooms()
      wx.showToast({ title: changed > 0 ? `已改名，${changed}棵植物已迁移` : '已改名', icon: 'none' })
    } else {
      this.setData({ showRenameModal: false })
      this.loadRooms()
      wx.showToast({ title: '已改名', icon: 'none' })
    }
  },

  confirmAdd() {
    const name = this.data.newRoomName.trim()
    if (!name) { wx.showToast({ title: '请输入房间名', icon: 'none' }); return }
    if (name.length > 6) { wx.showToast({ title: '最多6个字', icon: 'none' }); return }
    let customRooms = getCustomRooms()
    if (customRooms.includes(name) || PRESET_ROOMS.includes(name)) {
      wx.showToast({ title: '该房间已存在', icon: 'none' }); return
    }
    customRooms.push(name)
    setCustomRooms(customRooms)
    this.setData({ showAddModal: false })
    this.loadRooms()
    wx.showToast({ title: '已添加', icon: 'none' })
  },

  deleteRoom(e) {
    const name = e.currentTarget.dataset.name
    const migrationTarget = getDefaultMigrationTarget()
    const isPreset = e.currentTarget.dataset.preset
    wx.showModal({
      title: '删除房间',
      content: `确定删除「${name}」？该房间下的植物将移到「${migrationTarget}」。`,
      confirmColor: '#e53935',
      success: async (res) => {
        if (!res.confirm) return

        // 从自定义列表删除
        let customRooms = getCustomRooms()
        customRooms = customRooms.filter(r => r !== name)
        setCustomRooms(customRooms)

        // 清理重命名映射
        let renamedPresets = (() => { try { return wx.getStorageSync('renamedPresets') || {} } catch (e) { return {} } })()
        for (const [old, renamed] of Object.entries(renamedPresets)) {
          if (renamed === name) { delete renamedPresets[old]; break }
        }
        try { wx.setStorageSync('renamedPresets', renamedPresets) } catch (e) {}

        // 删环境参数
        const roomEnvs = (() => { try { return wx.getStorageSync('roomEnvs') || {} } catch (e) { return {} } })()
        delete roomEnvs[name]
        try { wx.setStorageSync('roomEnvs', roomEnvs) } catch (e) {}

        // 该房间的植物移到迁移目标（乐观更新+云端串行）
        const plants = family.getCachedPlants()
        const plantsToMove = plants.filter(p => p.location === name)
        for (const p of plantsToMove) {
          family.updatePlant(p._id, { location: migrationTarget, _prevLocation: name })
        }

        this.loadRooms()
        wx.showToast({ title: '已删除', icon: 'none' })
      }
    })
  },

  editEnv(e) {
    const name = e.currentTarget.dataset.name
    const roomEnvs = (() => { try { return wx.getStorageSync('roomEnvs') || {} } catch (e) { return {} } })()
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
    const roomEnvs = (() => { try { return wx.getStorageSync('roomEnvs') || {} } catch (e) { return {} } })()
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
