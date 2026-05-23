// utils/export.js — 养护数据导出

const storage = require('./storage')
const family = require('./family')

/**
 * 生成养护报告文本（用于分享/复制）
 */
function generateReport(plantId) {
  const isFamilyMode = family.isInFamily()
  let plant, tasks, records

  if (isFamilyMode) {
    plant = family.getPlantById(plantId)
    if (!plant) return null
    plant = { ...plant, id: plant._id }
    tasks = family.getCachedTasks(plantId)
    records = family.getCachedRecords(plantId)
  } else {
    plant = storage.getPlantById(plantId)
    if (!plant) return null
    tasks = storage.getTasksByPlant(plantId)
    records = storage.getRecordsByPlant(plantId)
  }
  const days = Math.floor((Date.now() - plant.addedAt) / 86400000)

  const lines = [
    `🪴 ${plant.nickname} · 养护报告`,
    `━━━━━━━━━━━━━━`,
    `📅 已养护 ${days} 天`,
    `📍 位置：${plant.location}`,
    `📝 养护记录：${records.length} 条`,
    `📋 养护任务：${tasks.length} 个`,
    ``
  ]

  // 最近5条记录
  if (records.length > 0) {
    lines.push('最近养护：')
    records.slice(0, 5).forEach(r => {
      const d = new Date(r.date)
      const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
      lines.push(`  ${dateStr} ${r.typeName}${r.note ? ' — ' + r.note : ''}`)
    })
  }

  lines.push('')
  lines.push('— 养花助手 🌸 —')

  return lines.join('\n')
}

/**
 * 复制报告到剪贴板
 */
function copyReport(plantId) {
  const text = generateReport(plantId)
  if (!text) {
    wx.showToast({ title: '生成失败', icon: 'none' })
    return
  }
  wx.setClipboardData({
    data: text,
    success: () => {
      wx.showToast({ title: '已复制到剪贴板', icon: 'none' })
    }
  })
}

/**
 * 生成花园总览报告
 */
function generateGardenReport() {
  const isFamilyMode = family.isInFamily()
  const garden = isFamilyMode
    ? family.getCachedPlants().map(p => ({ ...p, id: p._id }))
    : storage.getGarden()
  const stats = isFamilyMode
    ? { totalRecords: family.getCachedRecords('').length }
    : storage.getStats()

  if (garden.length === 0) return null

  const lines = [
    `🌱 我的花园 · 养护报告`,
    `━━━━━━━━━━━━━━`,
    `🌳 共 ${garden.length} 棵植物`,
    `📝 ${stats.totalRecords} 条养护记录`,
    ``
  ]

  garden.forEach(p => {
    const days = Math.floor((Date.now() - p.addedAt) / 86400000)
    let tasks
    if (isFamilyMode) {
      tasks = family.getCachedTasks(p.id).filter(t => t.enabled)
    } else {
      tasks = storage.getTasksByPlant(p.id).filter(t => t.enabled)
    }
    const dueCount = tasks.filter(t => {
      const d = new Date(t.nextDate)
      return d.getTime() <= Date.now()
    }).length
    lines.push(`${p.emoji} ${p.nickname} · ${days}天${dueCount > 0 ? ' · ⚠️' + dueCount + '项待办' : ''}`)
  })

  lines.push('')
  lines.push('— 养花助手 🌸 —')

  return lines.join('\n')
}

module.exports = {
  generateReport,
  copyReport,
  generateGardenReport
}
