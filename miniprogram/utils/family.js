// utils/family.js — 家庭模式工具模块 v2
// 封装家庭相关云函数调用、本地缓存、认养、积分、报表

const FAMILY_CACHE_KEY = '_family_info'
const FAMILY_PLANTS_KEY = '_family_plants'
const FAMILY_TASKS_KEY = '_family_tasks'
const FAMILY_RECORDS_KEY = '_family_records'
const CACHE_TTL = 5 * 60 * 1000

function callCloud(name, action, data) {
  return wx.cloud.callFunction({ name, data: { action, data } })
    .then(res => res.result)
    .catch(err => {
      console.error(`云函数 ${name}.${action} 失败:`, err)
      return { success: false, error: err.errMsg || err.message || '网络错误' }
    })
}

function manage(action, data) { return callCloud('familyManage', action, data) }
function fdata(action, data) { return callCloud('familyData', action, data) }

function isInFamily() {
  try {
    const info = wx.getStorageSync(FAMILY_CACHE_KEY)
    if (!info || !info.inFamily) return false
    if (Date.now() - (info._cachedAt || 0) > CACHE_TTL) return false
    return true
  } catch (e) { return false }
}

function getCachedFamily() {
  try {
    const info = wx.getStorageSync(FAMILY_CACHE_KEY)
    if (!info || !info.inFamily || Date.now() - (info._cachedAt || 0) > CACHE_TTL) return null
    return info
  } catch (e) { return null }
}

function getMyRole() { const info = getCachedFamily(); return info ? info.myRole : null }
function isAdmin() { return getMyRole() === 'admin' }

async function refreshFamilyInfo() {
  const result = await manage('info')
  if (result.success) {
    result._cachedAt = Date.now()
    try { wx.setStorageSync(FAMILY_CACHE_KEY, result) } catch (e) {}
  }
  return result
}

function clearCache() {
  try {
    wx.removeStorageSync(FAMILY_CACHE_KEY)
    wx.removeStorageSync(FAMILY_PLANTS_KEY)
    wx.removeStorageSync(FAMILY_TASKS_KEY)
    wx.removeStorageSync(FAMILY_RECORDS_KEY)
  } catch (e) {}
}

// ========== 植物 ==========

async function getPlants(forceRefresh) {
  if (!forceRefresh) {
    try {
      const cached = wx.getStorageSync(FAMILY_PLANTS_KEY)
      if (cached && cached._cachedAt && Date.now() - cached._cachedAt < CACHE_TTL) return cached.plants
    } catch (e) {}
  }
  const result = await fdata('getPlants')
  if (result.success) {
    try { wx.setStorageSync(FAMILY_PLANTS_KEY, { plants: result.plants, _cachedAt: Date.now() }) } catch (e) {}
    return result.plants
  }
  return []
}

function getCachedPlants() {
  try { const c = wx.getStorageSync(FAMILY_PLANTS_KEY); return c ? c.plants || [] : [] } catch (e) { return [] }
}

function getPlantById(plantId) {
  return getCachedPlants().find(p => p._id === plantId) || null
}

async function addPlant(plantData) {
  const result = await fdata('addPlant', plantData)
  if (result.success) await getPlants(true)
  return result
}

async function updatePlant(plantId, updates) {
  const result = await fdata('updatePlant', { plantId, updates })
  if (result.success) {
    try {
      const cached = wx.getStorageSync(FAMILY_PLANTS_KEY)
      if (cached && cached.plants) {
        const idx = cached.plants.findIndex(p => p._id === plantId)
        if (idx >= 0) { cached.plants[idx] = { ...cached.plants[idx], ...updates, updatedAt: Date.now() }; wx.setStorageSync(FAMILY_PLANTS_KEY, cached) }
      }
    } catch (e) {}
  }
  return result
}

async function removePlant(plantId) {
  const result = await fdata('deletePlant', { plantId })
  if (result.success) {
    try {
      const cached = wx.getStorageSync(FAMILY_PLANTS_KEY)
      if (cached && cached.plants) { cached.plants = cached.plants.filter(p => p._id !== plantId); wx.setStorageSync(FAMILY_PLANTS_KEY, cached) }
    } catch (e) {}
  }
  return result
}

// ========== 认养 ==========

async function toggleAdopt(plantId) {
  const result = await manage('toggleAdopt', { plantId })
  if (result.success) {
    await Promise.all([getPlants(true), refreshFamilyInfo()])
  }
  return result
}

function isAdoptedByMe(plantId) {
  const info = getCachedFamily()
  if (!info) return false
  return (info.myAdoptedPlants || []).includes(plantId)
}

function getAdopterNames(plant) {
  return plant.adopterNames || []
}

// ========== 任务 ==========

async function getTasks(plantId, forceRefresh) {
  if (!forceRefresh) {
    try {
      const cached = wx.getStorageSync(FAMILY_TASKS_KEY)
      if (cached && cached._cachedAt && Date.now() - cached._cachedAt < CACHE_TTL) {
        const tasks = cached.tasks || []
        return plantId ? tasks.filter(t => t.plantId === plantId) : tasks
      }
    } catch (e) {}
  }
  const result = await fdata('getTasks', { plantId: plantId || '' })
  if (result.success) {
    try { wx.setStorageSync(FAMILY_TASKS_KEY, { tasks: result.tasks, _cachedAt: Date.now() }) } catch (e) {}
    return result.tasks
  }
  return []
}

function getCachedTasks(plantId) {
  try {
    const cached = wx.getStorageSync(FAMILY_TASKS_KEY)
    const tasks = cached ? cached.tasks || [] : []
    return plantId ? tasks.filter(t => t.plantId === plantId) : tasks
  } catch (e) { return [] }
}

async function completeTask(taskId) {
  const result = await fdata('completeTask', { taskId })
  if (result.success) { await getTasks('', true); await getRecords('', 100, true) }
  return result
}

async function updateTask(taskId, updates) {
  const result = await fdata('updateTask', { taskId, updates })
  if (result.success) await getTasks('', true)
  return result
}

async function toggleTask(taskId) {
  const result = await fdata('toggleTask', { taskId })
  if (result.success) await getTasks('', true)
  return result
}

// ========== 记录 ==========

async function getRecords(plantId, limit, forceRefresh) {
  if (!forceRefresh) {
    try {
      const cached = wx.getStorageSync(FAMILY_RECORDS_KEY)
      if (cached && cached._cachedAt && Date.now() - cached._cachedAt < CACHE_TTL) {
        const records = cached.records || []
        return plantId ? records.filter(r => r.plantId === plantId) : records
      }
    } catch (e) {}
  }
  const result = await fdata('getRecords', { plantId: plantId || '', limit: limit || 100 })
  if (result.success) {
    try { wx.setStorageSync(FAMILY_RECORDS_KEY, { records: result.records, _cachedAt: Date.now() }) } catch (e) {}
    return result.records
  }
  return []
}

function getCachedRecords(plantId) {
  try {
    const cached = wx.getStorageSync(FAMILY_RECORDS_KEY)
    const records = cached ? cached.records || [] : []
    return plantId ? records.filter(r => r.plantId === plantId) : records
  } catch (e) { return [] }
}

async function addRecord(recordData) {
  const result = await fdata('addRecord', { record: recordData })
  if (result.success) await getRecords('', 100, true)
  return result
}

async function deleteRecord(recordId) {
  const result = await fdata('deleteRecord', { recordId })
  if (result.success) await getRecords('', 100, true)
  return result
}

// ========== 报表 ==========

async function getReport(period) {
  return await manage('report', { period: period || 'week' })
}

// ========== 新功能接口 ==========

async function getActivities(limit) {
  const result = await manage('activities', { limit: limit || 30 })
  return result.success ? result.activities : []
}

async function getWishlist() {
  const result = await manage('wishlist')
  return result.success ? result.wishlists : []
}

async function addWishlist(name, note) {
  return await manage('addWishlist', { name, note })
}

async function fulfillWishlist(wishlistId) {
  return await manage('fulfillWishlist', { wishlistId })
}

async function removeWishlist(wishlistId) {
  return await manage('removeWishlist', { wishlistId })
}

async function getMilestones(limit) {
  const result = await manage('milestones', { limit: limit || 20 })
  return result.success ? result.milestones : []
}

async function getPK(period) {
  return await manage('pk', { period: period || 'week' })
}

async function getHealthBoard() {
  return await manage('healthBoard')
}

async function getWeeklyReport() {
  return await manage('weeklyReport')
}

module.exports = {
  manage, data: fdata,
  isInFamily, getCachedFamily, getMyRole, isAdmin, refreshFamilyInfo, clearCache,
  getPlants, getCachedPlants, getPlantById, addPlant, updatePlant, removePlant,
  toggleAdopt, isAdoptedByMe, getAdopterNames,
  getTasks, getCachedTasks, completeTask, updateTask, toggleTask,
  getRecords, getCachedRecords, addRecord, deleteRecord,
  getReport,
  getActivities, getWishlist, addWishlist, fulfillWishlist, removeWishlist,
  getMilestones, getPK, getHealthBoard, getWeeklyReport
}
