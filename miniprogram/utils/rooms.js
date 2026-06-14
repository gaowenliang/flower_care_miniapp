// utils/rooms.js — 预设房间常量（统一出口）

const PRESET_ROOMS = ['阳台', '客厅', '卧室', '书房', '窗台', '花园']

function getCustomRooms() {
  try { return wx.getStorageSync('customRooms') || [] } catch (e) { return [] }
}

function setCustomRooms(rooms) {
  try { wx.setStorageSync('customRooms', rooms) } catch (e) {}
}

function getAllRooms() {
  const custom = getCustomRooms()
  return [...PRESET_ROOMS.filter(r => !custom.includes(r) || true), ...custom.filter(r => !PRESET_ROOMS.includes(r))]
}

module.exports = { PRESET_ROOMS, getCustomRooms, setCustomRooms, getAllRooms }
