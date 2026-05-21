// utils/validator.js — 输入校验工具

/**
 * 校验植物昵称
 * - 1-20个字符
 * - 不允许纯空格
 * - 过滤敏感HTML标签
 */
function validateNickname(name) {
  if (!name || !name.trim()) {
    return { valid: false, msg: '请输入植物名称' }
  }
  const trimmed = name.trim()
  if (trimmed.length > 20) {
    return { valid: false, msg: '名称最多20个字' }
  }
  // 过滤HTML标签
  if (/<[^>]+>/.test(trimmed)) {
    return { valid: false, msg: '名称不能包含特殊字符' }
  }
  return { valid: true, value: trimmed }
}

/**
 * 校验房间名
 * - 1-6个字符
 */
function validateRoomName(name) {
  if (!name || !name.trim()) {
    return { valid: false, msg: '请输入房间名称' }
  }
  const trimmed = name.trim()
  if (trimmed.length > 6) {
    return { valid: false, msg: '房间名最多6个字' }
  }
  return { valid: true, value: trimmed }
}

/**
 * 校验日记/备注内容
 * - 最多500字
 */
function validateNote(note) {
  if (!note || !note.trim()) {
    return { valid: false, msg: '请输入内容' }
  }
  if (note.trim().length > 500) {
    return { valid: false, msg: '内容最多500字' }
  }
  return { valid: true, value: note.trim() }
}

/**
 * 校验浇水周期
 * - 1-90天
 */
function validateInterval(days) {
  const num = parseInt(days)
  if (isNaN(num) || num < 1) {
    return { valid: false, msg: '最少1天' }
  }
  if (num > 90) {
    return { valid: false, msg: '最多90天' }
  }
  return { valid: true, value: num }
}

module.exports = {
  validateNickname,
  validateRoomName,
  validateNote,
  validateInterval
}
