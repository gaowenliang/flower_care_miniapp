// utils/family.js — 家庭模式工具模块
// 封装家庭相关云函数调用和本地缓存

const FAMILY_CACHE_KEY = '_family_info'
const FAMILY_PLANTS_KEY = '_family_plants'
const FAMILY_TASKS_KEY = '_family_tasks'
const FAMILY_RECORDS_KEY = '_family_records'
const CACHE_TTL = 5 * 60 * 1000 // 5分钟缓存

/**
 * 调用云函数的统一封装
 */
function callCloud(name, action, data) {
  return wx.cloud.callFunction({
    name,
    data: { action, data }
  }).then(res => res.result).catch(err => {
    console.error(`云函数 ${name}.${action} 失败:`, err)
    return { success: false, error: err.errMsg || err.message || '网络错误' }
  })
}

/**
 * 调用 familyManage 云函数
 */
function manage(action, data) {
  return callCloud('familyManage', action, data)
}

/**
 * 调用 familyData 云函数
 */
function data(action, data) {
  return callCloud('familyData', action, data)
}

/**
 * 是否在家庭中（读缓存，不网络请求）
 */
function isInFamily() {
  try {
    const info = wx.getStorageSync(FAMILY_CACHE_KEY)
    if (!info || !info.inFamily) return false
    if (Date.now() - (info._cachedAt || 0) > CACHE_TTL) return false
    return true
  } catch (e) {
    return false
  }
}

/**
 * 获取缓存的家庭信息
 */
function getCachedFamily() {
  try {
    const info = wx.getStorageSync(FAMILY_CACHE_KEY)
    if (!info || !info.inFamily) return null
    if (Date.now() - (info._cachedAt || 0) > CACHE_TTL) return null
    return info
  } catch (e) {
    return null
  }
}

/**
 * 获取缓存的成员角色
 */
function getMyRole() {
  const info = getCachedFamily()
  return info ? info.myRole : null
}

/**
 * 是否是管理员
 */
function isAdmin() {
  return getMyRole() === 'admin'
}

/**
 * 刷新家庭信息（网络请求）
 */
async function refreshFamilyInfo() {
  const result = await manage('info')
  if (result.success) {
    result._cachedAt = Date.now()
    try { wx.setStorageSync(FAMILY_CACHE_KEY, result) } catch (e) {}
  }
  return result
}

/**
 * 清除家庭缓存
 */
function clearCache() {
  try {
    wx.removeStorageSync(FAMILY_CACHE_KEY)
    wx.removeStorageSync(FAMILY_PLANTS_KEY)
    wx.removeStorageSync(FAMILY_TASKS_KEY)
    wx.removeStorageSync(FAMILY_RECORDS_KEY)
  } catch (e) {}
}

// ========== 植物操作 ==========

/**
 * 获取家庭植物列表（优先缓存）
 */
async function getPlants(forceRefresh) {
  if (!forceRefresh) {
    try {
      const cached = wx.getStorageSync(FAMILY_PLANTS_KEY)
      if (cached && cached._cachedAt && Date.now() - cached._cachedAt < CACHE_TTL) {
        return cached.plants
      }
    } catch (e) {}
  }

  const result = await data('getPlants')
  if (result.success) {
    try {
      wx.setStorageSync(FAMILY_PLANTS_KEY, { plants: result.plants, _cachedAt: Date.now() })
    } catch (e) {}
    return result.plants
  }
  return []
}

/**
 * 获取缓存植物列表（同步）
 */
function getCachedPlants() {
  try {
    const cached = wx.getStorageSync(FAMILY_PLANTS_KEY)
    return cached ? cached.plants || [] : []
  } catch (e) {
    return []
  }
}

/**
 * 添加植物到家庭
 */
async function addPlant(plantData) {
  const result = await data('addPlant', plantData)
  if (result.success) {
    // 刷新缓存
    await getPlants(true)
  }
  return result
}

/**
 * 更新家庭植物
 */
async function updatePlant(plantId, updates) {
  const result = await data('updatePlant', { plantId, updates })
  if (result.success) {
    // 更新本地缓存中的植物
    try {
      const cached = wx.getStorageSync(FAMILY_PLANTS_KEY)
      if (cached && cached.plants) {
        const idx = cached.plants.findIndex(p => p._id === plantId)
        if (idx >= 0) {
          cached.plants[idx] = { ...cached.plants[idx], ...updates, updatedAt: Date.now() }
          wx.setStorageSync(FAMILY_PLANTS_KEY, cached)
        }
      }
    } catch (e) {}
  }
  return result
}

/**
 * 删除家庭植物
 */
async function removePlant(plantId) {
  const result = await data('removePlant', { plantId })
  if (result.success) {
    // 移除本地缓存
    try {
      const cached = wx.getStorageSync(FAMILY_PLANTS_KEY)
      if (cached && cached.plants) {
        cached.plants = cached.plants.filter(p => p._id !== plantId)
        wx.setStorageSync(FAMILY_PLANTS_KEY, cached)
      }
    } catch (e) {}
  }
  return result
}

/**
 * 根据ID获取植物（从缓存）
 */
function getPlantById(plantId) {
  const plants = getCachedPlants()
  return plants.find(p => p._id === plantId) || null
}

// ========== 任务操作 ==========

/**
 * 获取家庭任务
 */
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

  const result = await data('getTasks', { plantId: plantId || '' })
  if (result.success) {
    try {
      wx.setStorageSync(FAMILY_TASKS_KEY, { tasks: result.tasks, _cachedAt: Date.now() })
    } catch (e) {}
    return result.tasks
  }
  return []
}

/**
 * 获取缓存的任务
 */
function getCachedTasks(plantId) {
  try {
    const cached = wx.getStorageSync(FAMILY_TASKS_KEY)
    const tasks = cached ? cached.tasks || [] : []
    return plantId ? tasks.filter(t => t.plantId === plantId) : tasks
  } catch (e) {
    return []
  }
}

/**
 * 完成任务
 */
async function completeTask(taskId) {
  const result = await data('completeTask', { taskId })
  if (result.success) {
    await getTasks('', true) // 刷新所有任务
  }
  return result
}

/**
 * 更新任务
 */
async function updateTask(taskId, updates) {
  const result = await data('updateTask', { taskId, updates })
  if (result.success) {
    await getTasks('', true)
  }
  return result
}

/**
 * 切换任务启用
 */
async function toggleTask(taskId) {
  const result = await data('toggleTask', { taskId })
  if (result.success) {
    await getTasks('', true)
  }
  return result
}

// ========== 记录操作 ==========

/**
 * 获取养护记录
 */
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

  const result = await data('getRecords', { plantId: plantId || '', limit: limit || 100 })
  if (result.success) {
    try {
      wx.setStorageSync(FAMILY_RECORDS_KEY, { records: result.records, _cachedAt: Date.now() })
    } catch (e) {}
    return result.records
  }
  return []
}

/**
 * 获取缓存记录
 */
function getCachedRecords(plantId) {
  try {
    const cached = wx.getStorageSync(FAMILY_RECORDS_KEY)
    const records = cached ? cached.records || [] : []
    return plantId ? records.filter(r => r.plantId === plantId) : records
  } catch (e) {
    return []
  }
}

/**
 * 添加养护记录
 */
async function addRecord(recordData) {
  const result = await data('addRecord', recordData)
  if (result.success) {
    await getRecords('', 100, true) // 刷新缓存
  }
  return result
}

/**
 * 删除记录
 */
async function deleteRecord(recordId) {
  const result = await data('deleteRecord', { recordId })
  if (result.success) {
    await getRecords('', 100, true)
  }
  return result
}

module.exports = {
  // 云函数调用
  manage,
  data: data,
  // 状态判断
  isInFamily,
  getCachedFamily,
  getMyRole,
  isAdmin,
  refreshFamilyInfo,
  clearCache,
  // 植物
  getPlants,
  getCachedPlants,
  getPlantById,
  addPlant,
  updatePlant,
  removePlant,
  // 任务
  getTasks,
  getCachedTasks,
  completeTask,
  updateTask,
  toggleTask,
  // 记录
  getRecords,
  getCachedRecords,
  addRecord,
  deleteRecord
}
