// utils/cloud-sync.js — 云数据同步模块
// 策略：写入时双写（本地+云端），读取优先本地，启动时拉取云端合并

const CLOUD_ENABLED = typeof wx !== 'undefined' && wx.cloud

// 云数据库集合名
const COLLECTIONS = {
  GARDEN: 'user_plants',
  TASKS: 'care_tasks',
  RECORDS: 'care_records',
  SETTINGS: 'user_settings',
  ACHIEVEMENTS: 'user_achievements',
  CUSTOM_ROOMS: 'user_custom_rooms',
  RETRO: 'user_retro_cards'
}

/**
 * 获取云数据库引用
 */
function db() {
  if (!CLOUD_ENABLED) return null
  return wx.cloud.database()
}

/**
 * 获取用户唯一标识（用 openid 的 hash）
 */
function getUserKey() {
  // 云数据库自带 openid 权限，无需手动传
  return '_default'
}

/**
 * ===== 写入操作 =====
 */

async function saveCollection(collectionName, data) {
  if (!db()) return
  try {
    // 先查是否已有记录
    const countResult = await db().collection(collectionName).count()
    if (countResult.total === 0) {
      // 首次：创建
      await db().collection(collectionName).add({ data: { payload: data, updatedAt: Date.now() } })
    } else {
      // 更新：取第一条记录
      const first = await db().collection(collectionName).limit(1).get()
      if (first.data.length > 0) {
        await db().collection(collectionName).doc(first.data[0]._id).update({
          data: { payload: data, updatedAt: Date.now() }
        })
      }
    }
  } catch (e) {
    console.warn(`云同步写入 ${collectionName} 失败:`, e.message)
  }
}

/**
 * ===== 读取操作 =====
 */

async function loadCollection(collectionName) {
  if (!db()) return null
  try {
    const result = await db().collection(collectionName).limit(1).get()
    if (result.data.length > 0 && result.data[0].payload) {
      return result.data[0].payload
    }
    return null
  } catch (e) {
    console.warn(`云同步读取 ${collectionName} 失败:`, e.message)
    return null
  }
}

/**
 * ===== 批量同步 =====
 */

/**
 * 上传所有本地数据到云端（首次同步或手动备份）
 */
async function uploadAll(localData) {
  if (!db()) return { success: false, reason: '云开发未启用' }

  const results = {}
  const tasks = [
    { key: 'garden', col: COLLECTIONS.GARDEN },
    { key: 'tasks', col: COLLECTIONS.TASKS },
    { key: 'records', col: COLLECTIONS.RECORDS },
    { key: 'settings', col: COLLECTIONS.SETTINGS },
    { key: 'achievements', col: COLLECTIONS.ACHIEVEMENTS },
    { key: 'customRooms', col: COLLECTIONS.CUSTOM_ROOMS },
    { key: 'retroCards', col: COLLECTIONS.RETRO }
  ]

  for (const t of tasks) {
    if (localData[t.key] !== undefined) {
      await saveCollection(t.col, localData[t.key])
      results[t.key] = true
    }
  }

  return { success: true, results }
}

/**
 * 从云端拉取所有数据（恢复/多设备同步）
 */
async function downloadAll() {
  if (!db()) return null

  const tasks = [
    { key: 'garden', col: COLLECTIONS.GARDEN },
    { key: 'tasks', col: COLLECTIONS.TASKS },
    { key: 'records', col: COLLECTIONS.RECORDS },
    { key: 'settings', col: COLLECTIONS.SETTINGS },
    { key: 'achievements', col: COLLECTIONS.ACHIEVEMENTS },
    { key: 'customRooms', col: COLLECTIONS.CUSTOM_ROOMS },
    { key: 'retroCards', col: COLLECTIONS.RETRO }
  ]

  const data = {}
  for (const t of tasks) {
    const result = await loadCollection(t.col)
    if (result !== null) {
      data[t.key] = result
    }
  }

  return data
}

/**
 * 启动时合并：云端数据覆盖本地（云端为准）
 * 但如果本地有数据云端没有，保留本地
 */
async function syncOnStartup(storage) {
  if (!db()) return { synced: false }

  try {
    const cloudData = await downloadAll()
    if (!cloudData || Object.keys(cloudData).length === 0) {
      // 云端没数据，把本地上传
      const localData = {
        garden: storage.getGarden(),
        tasks: storage.getTasks(),
        records: storage.getRecords(),
        settings: storage.getSettings(),
        achievements: storage.getUnlockedAchievements ? storage.getUnlockedAchievements() : [],
        customRooms: storage.getCustomRooms ? storage.getCustomRooms() : [],
        retroCards: storage.getRetroData ? storage.getRetroData() : {}
      }
      await uploadAll(localData)
      return { synced: true, action: 'uploaded' }
    }

    // 云端有数据，合并到本地
    let merged = 0
    if (cloudData.garden && Array.isArray(cloudData.garden)) {
      storage.saveGarden(cloudData.garden)
      merged++
    }
    if (cloudData.tasks && Array.isArray(cloudData.tasks)) {
      storage.saveTasks(cloudData.tasks)
      merged++
    }
    if (cloudData.records && Array.isArray(cloudData.records)) {
      try { wx.setStorageSync(storage.KEYS.RECORDS, cloudData.records) } catch (e) {}
      merged++
    }
    if (cloudData.settings && typeof cloudData.settings === 'object') {
      storage.saveSettings(cloudData.settings)
      merged++
    }
    if (cloudData.achievements && Array.isArray(cloudData.achievements)) {
      try { wx.setStorageSync('achievements', cloudData.achievements) } catch (e) {}
      merged++
    }
    if (cloudData.customRooms && Array.isArray(cloudData.customRooms)) {
      try { wx.setStorageSync('customRooms', cloudData.customRooms) } catch (e) {}
      merged++
    }
    if (cloudData.retroCards && typeof cloudData.retroCards === 'object') {
      try { wx.setStorageSync(storage.KEYS.RETRO, cloudData.retroCards) } catch (e) {}
      merged++
    }

    return { synced: true, action: 'merged', collections: merged }
  } catch (e) {
    console.warn('启动同步失败:', e)
    return { synced: false, error: e.message }
  }
}

/**
 * 单项同步（写入后立即调）
 */
async function syncItem(key, data) {
  const colMap = {
    garden: COLLECTIONS.GARDEN,
    tasks: COLLECTIONS.TASKS,
    records: COLLECTIONS.RECORDS,
    settings: COLLECTIONS.SETTINGS,
    achievements: COLLECTIONS.ACHIEVEMENTS,
    customRooms: COLLECTIONS.CUSTOM_ROOMS,
    retroCards: COLLECTIONS.RETRO
  }

  const col = colMap[key]
  if (!col) return

  await saveCollection(col, data)
}

module.exports = {
  COLLECTIONS,
  uploadAll,
  downloadAll,
  syncOnStartup,
  syncItem,
  isCloudEnabled: () => CLOUD_ENABLED
}
