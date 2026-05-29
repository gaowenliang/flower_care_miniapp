// utils/family.js — 家庭模式工具模块 v3
// 封装家庭相关云函数调用、本地缓存、认养、积分、报表
// v3: 加入乐观写（先本地后云端）+ 写队列 + 失败回滚

const FAMILY_CACHE_KEY = '_family_info'
const FAMILY_PLANTS_KEY = '_family_plants'
const FAMILY_TASKS_KEY = '_family_tasks'
const FAMILY_RECORDS_KEY = '_family_records'
const CACHE_TTL = 5 * 60 * 1000

let _tempIdCounter = 0
function _genTempId() {
  return '_opt_' + Date.now() + '_' + (++_tempIdCounter)
}

// ========== 云函数基础调用 ==========

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

// ========== 写队列（串行，避免并发冲突）==========

const _writeQueue = []
let _writing = false

function enqueueWrite(fn) {
  return new Promise((resolve) => {
    _writeQueue.push({ fn, resolve })
    _drainQueue()
  })
}

async function _drainQueue() {
  if (_writing) return
  _writing = true
  while (_writeQueue.length > 0) {
    const { fn, resolve } = _writeQueue.shift()
    try {
      const result = await fn()
      resolve(result)
    } catch (e) {
      resolve({ success: false, error: e.message || '未知错误' })
    }
  }
  _writing = false
}

// ========== 缓存工具 ==========

function _saveCache(key, data) {
  try { wx.setStorageSync(key, data) } catch (e) {}
}

function _readCache(key) {
  try { return wx.getStorageSync(key) } catch (e) { return null }
}

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
    _saveCache(FAMILY_CACHE_KEY, result)
    return result
  }
  return { success: true, inFamily: false, _networkError: true }
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
    const cached = _readCache(FAMILY_PLANTS_KEY)
    if (cached && cached._cachedAt && Date.now() - cached._cachedAt < CACHE_TTL) return cached.plants
  }
  const result = await fdata('getPlants')
  if (result.success) {
    _saveCache(FAMILY_PLANTS_KEY, { plants: result.plants, _cachedAt: Date.now() })
    return result.plants
  }
  return []
}

function getCachedPlants() {
  const c = _readCache(FAMILY_PLANTS_KEY)
  return c ? c.plants || [] : []
}

function getPlantById(plantId) {
  return getCachedPlants().find(p => p._id === plantId) || null
}

/**
 * 添加植物 — 乐观写
 */
function addPlant(plantData) {
  // 防重复（同 plantId + 同 nickname）
  const cached = _readCache(FAMILY_PLANTS_KEY)
  if (cached && cached.plants) {
    const dup = cached.plants.find(p => p.plantId === plantData.plantId && p.nickname === plantData.nickname && !p._id.startsWith('_opt_'))
    if (dup) return Promise.resolve({ success: false, error: '该植物已添加' })
  }

  const tempId = _genTempId()
  const now = Date.now()

  // 乐观写入本地缓存
  const cache = cached || { plants: [], _cachedAt: now }
  cache.plants.unshift({
    _id: tempId,
    ...plantData,
    addedAt: now,
    createdAt: now,
    updatedAt: now,
    adopters: [],
    adopterNames: []
  })
  _saveCache(FAMILY_PLANTS_KEY, cache)

  // 后台推云端
  enqueueWrite(async () => {
    const result = await fdata('addPlant', { plant: plantData })
    if (result.success && result.plantId) {
      // 用真实 ID 替换临时 ID
      const c = _readCache(FAMILY_PLANTS_KEY)
      if (c && c.plants) {
        const idx = c.plants.findIndex(p => p._id === tempId)
        if (idx >= 0) { c.plants[idx]._id = result.plantId; _saveCache(FAMILY_PLANTS_KEY, c) }
      }
      // 静默拉一次完整数据
      getPlants(true).catch(() => {})
      getTasks('', true).catch(() => {})
    } else {
      // 失败：移除乐观写入的植物
      const c = _readCache(FAMILY_PLANTS_KEY)
      if (c && c.plants) {
        c.plants = c.plants.filter(p => p._id !== tempId)
        _saveCache(FAMILY_PLANTS_KEY, c)
      }
    }
    return result
  })

  return Promise.resolve({ success: true, plantId: tempId, _optimistic: true })
}

/**
 * 更新植物 — 乐观写
 */
function updatePlant(plantId, updates) {
  const cached = _readCache(FAMILY_PLANTS_KEY)
  if (cached && cached.plants) {
    const idx = cached.plants.findIndex(p => p._id === plantId)
    if (idx >= 0) {
      const snapshot = JSON.parse(JSON.stringify(cached.plants[idx]))
      cached.plants[idx] = { ...cached.plants[idx], ...updates, updatedAt: Date.now() }
      _saveCache(FAMILY_PLANTS_KEY, cached)

      enqueueWrite(async () => {
        const result = await fdata('updatePlant', { plantId, updates })
        if (!result.success) {
          const c = _readCache(FAMILY_PLANTS_KEY)
          if (c && c.plants) {
            const i = c.plants.findIndex(p => p._id === plantId)
            if (i >= 0) { c.plants[i] = snapshot; _saveCache(FAMILY_PLANTS_KEY, c) }
          }
        }
        return result
      })
    }
  }
  return Promise.resolve({ success: true, _optimistic: true })
}

/**
 * 删除植物 — 乐观写
 */
function removePlant(plantId) {
  const cached = _readCache(FAMILY_PLANTS_KEY)
  let removed = null
  if (cached && cached.plants) {
    removed = cached.plants.find(p => p._id === plantId)
    cached.plants = cached.plants.filter(p => p._id !== plantId)
    _saveCache(FAMILY_PLANTS_KEY, cached)
  }

  enqueueWrite(async () => {
    const result = await fdata('deletePlant', { plantId })
    if (!result.success && removed) {
      // 回滚
      const c = _readCache(FAMILY_PLANTS_KEY)
      if (c && c.plants) { c.plants.push(removed); _saveCache(FAMILY_PLANTS_KEY, c) }
    }
    return result
  })

  return Promise.resolve({ success: true, _optimistic: true })
}

// ========== 认养（乐观写）==========

function toggleAdopt(plantId) {
  const info = getCachedFamily()
  const wasAdopted = info && (info.myAdoptedPlants || []).includes(plantId)

  // 乐观更新认养状态
  if (info) {
    if (wasAdopted) {
      info.myAdoptedPlants = (info.myAdoptedPlants || []).filter(id => id !== plantId)
    } else {
      info.myAdoptedPlants = [...(info.myAdoptedPlants || []), plantId]
    }
    _saveCache(FAMILY_CACHE_KEY, info)
  }

  enqueueWrite(async () => {
    const result = await manage('toggleAdopt', { plantId })
    if (result.success) {
      // 成功后静默刷新完整数据
      getPlants(true).catch(() => {})
      refreshFamilyInfo().catch(() => {})
    } else {
      // 回滚
      if (info) {
        if (wasAdopted) {
          info.myAdoptedPlants = [...(info.myAdoptedPlants || []), plantId]
        } else {
          info.myAdoptedPlants = (info.myAdoptedPlants || []).filter(id => id !== plantId)
        }
        _saveCache(FAMILY_CACHE_KEY, info)
      }
    }
    return result
  })

  return Promise.resolve({ success: true, adopted: !wasAdopted, _optimistic: true })
}

function isAdoptedByMe(plantId) {
  const info = getCachedFamily()
  if (!info) return false
  return (info.myAdoptedPlants || []).includes(plantId)
}

function getAdopterNames(plant) {
  return plant.adopterNames || []
}

// ========== 任务（乐观写）==========

async function getTasks(plantId, forceRefresh) {
  if (!forceRefresh) {
    const cached = _readCache(FAMILY_TASKS_KEY)
    if (cached && cached._cachedAt && Date.now() - cached._cachedAt < CACHE_TTL) {
      const tasks = cached.tasks || []
      return plantId ? tasks.filter(t => t.plantId === plantId) : tasks
    }
  }
  const result = await fdata('getTasks', { plantId: plantId || '' })
  if (result.success) {
    _saveCache(FAMILY_TASKS_KEY, { tasks: result.tasks, _cachedAt: Date.now() })
    return result.tasks
  }
  return []
}

function getCachedTasks(plantId) {
  const cached = _readCache(FAMILY_TASKS_KEY)
  const tasks = cached ? cached.tasks || [] : []
  return plantId ? tasks.filter(t => t.plantId === plantId) : tasks
}

/**
 * 完成任务 — 乐观写
 */
function completeTask(taskId, note) {
  const cached = _readCache(FAMILY_TASKS_KEY)
  const tasks = cached ? cached.tasks || [] : []
  const task = tasks.find(t => t._id === taskId)
  if (!task) return Promise.resolve({ success: false, error: '任务不存在' })

  const snapshot = JSON.parse(JSON.stringify(task))
  const now = Date.now()
  task.lastDoneDate = now
  task.nextDate = now + (task.intervalDays || 7) * 86400000
  _saveCache(FAMILY_TASKS_KEY, cached)

  // 乐观插入一条记录
  const cachedRec = _readCache(FAMILY_RECORDS_KEY)
  if (cachedRec && cachedRec.records) {
    // 从最近一条云端记录推断当前用户昵称
    const existingRecord = (cachedRec.records || []).find(r => r.creatorNickname && !r._id.startsWith('_opt_'))
    const myNickname = existingRecord ? existingRecord.creatorNickname : '我'
    cachedRec.records.unshift({
      _id: _genTempId(),
      plantId: task.plantId || task.userPlantId,
      userPlantId: task.userPlantId,
      type: task.type, typeName: task.typeName,
      date: now, note: note || '',
      createdBy: '', creatorNickname: myNickname, createdAt: now
    })
    _saveCache(FAMILY_RECORDS_KEY, cachedRec)
  }

  enqueueWrite(async () => {
    const result = await fdata('completeTask', { taskId, note })
    if (result.success) {
      getTasks('', true).catch(() => {})
      getRecords('', 500, true).catch(() => {})
    } else {
      const c = _readCache(FAMILY_TASKS_KEY)
      if (c && c.tasks) {
        const idx = c.tasks.findIndex(t => t._id === taskId)
        if (idx >= 0) c.tasks[idx] = snapshot
        _saveCache(FAMILY_TASKS_KEY, c)
      }
      console.warn('completeTask 云端失败，已回滚本地')
    }
    return result
  })

  return Promise.resolve({ success: true, nextDate: task.nextDate, _optimistic: true })
}

/**
 * 更新任务间隔 — 乐观写
 */
function updateTask(taskId, updates) {
  const cached = _readCache(FAMILY_TASKS_KEY)
  const tasks = cached ? cached.tasks || [] : []
  const task = tasks.find(t => t._id === taskId)
  if (!task) return Promise.resolve({ success: false, error: '任务不存在' })

  const snapshot = JSON.parse(JSON.stringify(task))
  Object.assign(task, updates)
  if (updates.intervalDays) {
    task.nextDate = (task.lastDoneDate || Date.now()) + updates.intervalDays * 86400000
    if (task.nextDate < Date.now()) task.nextDate = Date.now() + updates.intervalDays * 86400000
  }
  _saveCache(FAMILY_TASKS_KEY, cached)

  enqueueWrite(async () => {
    const result = await fdata('updateTask', { taskId, updates })
    if (!result.success) {
      const c = _readCache(FAMILY_TASKS_KEY)
      if (c && c.tasks) {
        const idx = c.tasks.findIndex(t => t._id === taskId)
        if (idx >= 0) c.tasks[idx] = snapshot
        _saveCache(FAMILY_TASKS_KEY, c)
      }
    }
    return result
  })

  return Promise.resolve({ success: true, _optimistic: true })
}

/**
 * 切换任务启用 — 乐观写
 */
function toggleTask(taskId) {
  const cached = _readCache(FAMILY_TASKS_KEY)
  const tasks = cached ? cached.tasks || [] : []
  const task = tasks.find(t => t._id === taskId)
  if (!task) return Promise.resolve({ success: false, error: '任务不存在' })

  const oldEnabled = task.enabled
  task.enabled = !task.enabled
  _saveCache(FAMILY_TASKS_KEY, cached)

  enqueueWrite(async () => {
    const result = await fdata('toggleTask', { taskId })
    if (!result.success) {
      task.enabled = oldEnabled
      _saveCache(FAMILY_TASKS_KEY, cached)
    }
    return result
  })

  return Promise.resolve({ success: true, enabled: task.enabled, _optimistic: true })
}

// ========== 记录（乐观写）==========

async function getRecords(plantId, limit, forceRefresh) {
  if (!forceRefresh) {
    const cached = _readCache(FAMILY_RECORDS_KEY)
    if (cached && cached._cachedAt && Date.now() - cached._cachedAt < CACHE_TTL) {
      const records = cached.records || []
      return plantId ? records.filter(r => r.plantId === plantId) : records
    }
  }
  const result = await fdata('getRecords', { plantId: plantId || '', limit: limit || 500 })
  if (result.success) {
    _saveCache(FAMILY_RECORDS_KEY, { records: result.records, _cachedAt: Date.now() })
    return result.records
  }
  return []
}

function getCachedRecords(plantId) {
  const cached = _readCache(FAMILY_RECORDS_KEY)
  const records = cached ? cached.records || [] : []
  return plantId ? records.filter(r => r.plantId === plantId) : records
}

/**
 * 添加记录 — 乐观写
 */
function addRecord(recordData) {
  const now = Date.now()
  const tempId = _genTempId()

  const cached = _readCache(FAMILY_RECORDS_KEY) || { records: [], _cachedAt: now }
  cached.records.unshift({
    _id: tempId,
    ...recordData,
    date: recordData.date || now,
    createdAt: now
  })
  _saveCache(FAMILY_RECORDS_KEY, cached)

  enqueueWrite(async () => {
    const result = await fdata('addRecord', { record: recordData })
    if (result.success) {
      getRecords('', 500, true).catch(() => {})
    } else {
      const c = _readCache(FAMILY_RECORDS_KEY)
      if (c && c.records) {
        c.records = c.records.filter(r => r._id !== tempId)
        _saveCache(FAMILY_RECORDS_KEY, c)
      }
    }
    return result
  })

  return Promise.resolve({ success: true, _optimistic: true })
}

/**
 * 删除记录 — 乐观写
 */
function deleteRecord(recordId) {
  const cached = _readCache(FAMILY_RECORDS_KEY)
  let removed = null
  if (cached && cached.records) {
    removed = cached.records.find(r => r._id === recordId)
    cached.records = cached.records.filter(r => r._id !== recordId)
    _saveCache(FAMILY_RECORDS_KEY, cached)
  }

  enqueueWrite(async () => {
    const result = await fdata('deleteRecord', { recordId })
    if (!result.success && removed) {
      const c = _readCache(FAMILY_RECORDS_KEY)
      if (c && c.records) { c.records.push(removed); _saveCache(FAMILY_RECORDS_KEY, c) }
    }
    return result
  })

  return Promise.resolve({ success: true, _optimistic: true })
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
