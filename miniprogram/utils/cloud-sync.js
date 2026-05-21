// utils/cloud-sync.js — 云数据同步模块 v2
// 策略：增量同步 + 时间戳冲突解决 + debounce合并 + 离线队列

const CLOUD_ENABLED = typeof wx !== 'undefined' && wx.cloud

const COLLECTIONS = {
  GARDEN: 'user_plants',
  TASKS: 'care_tasks',
  RECORDS: 'care_records',
  SETTINGS: 'user_settings',
  RETRO: 'user_retro_cards'
}

// debounce 定时器
const pendingSyncs = {}
const SYNC_DELAY = 3000 // 3秒内合并多次写入

// 离线队列
let offlineQueue = []

function db() {
  if (!CLOUD_ENABLED) return null
  return wx.cloud.database()
}

/**
 * 获取云端时间戳
 */
async function getCloudMeta(collectionName) {
  if (!db()) return null
  try {
    const result = await db().collection('_sync_meta').where({ collection: collectionName }).limit(1).get()
    if (result.data.length > 0) return result.data[0]
    return null
  } catch (e) {
    return null
  }
}

async function setCloudMeta(collectionName, meta) {
  if (!db()) return
  try {
    const existing = await getCloudMeta(collectionName)
    if (existing) {
      await db().collection('_sync_meta').doc(existing._id).update({ data: meta })
    } else {
      await db().collection('_sync_meta').add({ data: { collection: collectionName, ...meta } })
    }
  } catch (e) {
    console.warn('sync meta 写入失败:', e.message)
  }
}

/**
 * 增量同步单个集合 — 按项目ID做 merge，不是全量覆盖
 */
async function incrementalSync(collectionName, localData) {
  if (!db() || !localData) return

  try {
    // 获取云端数据
    const cloudResult = await db().collection(collectionName).limit(1).get()
    let cloudItems = []
    let cloudDocId = null

    if (cloudResult.data.length > 0 && cloudResult.data[0].payload) {
      cloudItems = cloudResult.data[0].payload
      cloudDocId = cloudResult.data[0]._id
    }

    if (!Array.isArray(cloudItems)) cloudItems = []
    if (!Array.isArray(localData)) localData = []

    // 按 id 做 merge：本地修改时间 >= 云端时间的覆盖
    const localMap = {}
    localData.forEach(item => {
      if (item && item.id) localMap[item.id] = item
    })

    const cloudMap = {}
    const cloudDeleted = new Set()
    cloudItems.forEach(item => {
      if (item && item.id) {
        cloudMap[item.id] = item
        if (item._deleted) cloudDeleted.add(item.id)
      }
    })

    // 合并策略：
    // 1. 本地有、云端有 → 取 updatedAt 更大的
    // 2. 本地有、云端没有 → 上传（除非云端标记已删除）
    // 3. 本地没有、云端有 → 保留云端（除非本地刚删除）
    const merged = []
    const allIds = new Set([...Object.keys(localMap), ...Object.keys(cloudMap)])

    allIds.forEach(id => {
      const local = localMap[id]
      const cloud = cloudMap[id]

      if (cloudDeleted.has(id) && !local) {
        // 云端已删除且本地没有 → 跳过
        return
      }

      if (local && cloud) {
        // 两边都有，取更新的
        const localTime = local.updatedAt || local.addedAt || 0
        const cloudTime = cloud.updatedAt || cloud.addedAt || 0
        merged.push(localTime >= cloudTime ? local : cloud)
      } else if (local) {
        // 只有本地
        merged.push(local)
      } else if (cloud && !cloud._deleted) {
        // 只有云端
        merged.push(cloud)
      }
    })

    // 写回云端
    const payload = merged.filter(item => !item._deleted)
    const now = Date.now()

    if (cloudDocId) {
      await db().collection(collectionName).doc(cloudDocId).update({
        data: { payload, updatedAt: now }
      })
    } else {
      await db().collection(collectionName).add({
        data: { payload, updatedAt: now }
      })
    }

    await setCloudMeta(collectionName, { lastSync: now, count: payload.length })
    return { success: true, count: payload.length }

  } catch (e) {
    console.warn(`增量同步 ${collectionName} 失败:`, e.message)
    return { success: false, error: e.message }
  }
}

/**
 * Debounce 同步 — 短时间内多次写入合并为一次同步
 */
function debouncedSync(key, collectionName, getData) {
  if (pendingSyncs[key]) {
    clearTimeout(pendingSyncs[key])
  }

  pendingSyncs[key] = setTimeout(async () => {
    delete pendingSyncs[key]
    const data = getData()
    if (data) {
      await incrementalSync(collectionName, data)
    }
  }, SYNC_DELAY)
}

/**
 * 启动时同步：双向合并
 */
async function syncOnStartup(storage) {
  if (!db()) return { synced: false, reason: '云开发未启用' }

  try {
    const syncTasks = [
      { key: 'garden', col: COLLECTIONS.GARDEN, localGet: () => storage.getGarden(), localSave: (d) => storage.saveGarden(d) },
      { key: 'tasks', col: COLLECTIONS.TASKS, localGet: () => storage.getTasks(), localSave: (d) => storage.saveTasks(d) },
      { key: 'records', col: COLLECTIONS.RECORDS, localGet: () => {
        try { return wx.getStorageSync(storage.KEYS.RECORDS) || [] } catch(e) { return [] }
      }, localSave: (d) => {
        try { wx.setStorageSync(storage.KEYS.RECORDS, d) } catch(e) {}
      }},
      { key: 'settings', col: COLLECTIONS.SETTINGS, localGet: () => storage.getSettings(), localSave: (d) => storage.saveSettings(d) },
      { key: 'retroCards', col: COLLECTIONS.RETRO, localGet: () => {
        try { return Object.values(wx.getStorageSync(storage.KEYS.RETRO) || {}) } catch(e) { return [] }
      }, localSave: (d) => {
        try {
          const map = {}
          d.forEach(item => { if (item && item.id) map[item.id] = item })
          wx.setStorageSync(storage.KEYS.RETRO, map)
        } catch(e) {}
      }}
    ]

    let synced = 0
    for (const t of syncTasks) {
      const localData = t.localGet()
      const cloudResult = await db().collection(t.col).limit(1).get()

      if (cloudResult.data.length === 0 || !cloudResult.data[0].payload) {
        // 云端没数据，上传本地
        if (localData && (Array.isArray(localData) ? localData.length > 0 : Object.keys(localData).length > 0)) {
          const now = Date.now()
          await db().collection(t.col).add({ data: { payload: Array.isArray(localData) ? localData : Object.values(localData), updatedAt: now } })
          synced++
        }
        continue
      }

      // 云端有数据，做增量合并
      const cloudPayload = cloudResult.data[0].payload || []
      const localArr = Array.isArray(localData) ? localData : Object.values(localData || {})
      const cloudArr = Array.isArray(cloudPayload) ? cloudPayload : []

      // 合并
      const merged = mergeArrays(localArr, cloudArr)

      // 写回本地
      t.localSave(merged)

      // 写回云端
      await db().collection(t.col).doc(cloudResult.data[0]._id).update({
        data: { payload: merged, updatedAt: Date.now() }
      })

      synced++
    }

    return { synced: true, collections: synced }
  } catch (e) {
    console.warn('启动同步失败:', e)
    return { synced: false, error: e.message }
  }
}

/**
 * 通用合并：按 id 匹配，取更新的
 */
function mergeArrays(localArr, cloudArr) {
  if (!Array.isArray(localArr)) localArr = []
  if (!Array.isArray(cloudArr)) cloudArr = []

  const map = new Map()

  cloudArr.forEach(item => {
    if (item && item.id) map.set(item.id, item)
  })

  localArr.forEach(item => {
    if (!item || !item.id) return
    const cloud = map.get(item.id)
    if (!cloud) {
      map.set(item.id, item)
    } else {
      const localTime = item.updatedAt || item.addedAt || 0
      const cloudTime = cloud.updatedAt || cloud.addedAt || 0
      if (localTime >= cloudTime) {
        map.set(item.id, { ...cloud, ...item })
      }
      // else 保留 cloud
    }
  })

  return Array.from(map.values()).filter(item => !item._deleted)
}

/**
 * 手动备份（全量上传覆盖云端）
 */
async function uploadAll(storage) {
  if (!db()) return { success: false, reason: '云开发未启用' }

  const now = Date.now()
  const tasks = [
    { col: COLLECTIONS.GARDEN, data: storage.getGarden() },
    { col: COLLECTIONS.TASKS, data: storage.getTasks() },
    { col: COLLECTIONS.RECORDS, data: (() => { try { return wx.getStorageSync(storage.KEYS.RECORDS) || [] } catch(e) { return [] } })() },
    { col: COLLECTIONS.SETTINGS, data: storage.getSettings() },
    { col: COLLECTIONS.RETRO, data: (() => { try { return Object.values(wx.getStorageSync(storage.KEYS.RETRO) || {}) } catch(e) { return [] } })() }
  ]

  const results = {}
  for (const t of tasks) {
    try {
      const payload = Array.isArray(t.data) ? t.data : [t.data]
      const existing = await db().collection(t.col).limit(1).get()
      if (existing.data.length > 0) {
        await db().collection(t.col).doc(existing.data[0]._id).update({ data: { payload, updatedAt: now } })
      } else {
        await db().collection(t.col).add({ data: { payload, updatedAt: now } })
      }
      results[t.col] = true
    } catch (e) {
      results[t.col] = false
    }
  }

  return { success: true, results }
}

/**
 * 手动恢复（全量下载覆盖本地）
 */
async function downloadAll(storage) {
  if (!db()) return { success: false, reason: '云开发未启用' }

  const collections = [
    { col: COLLECTIONS.GARDEN, save: (d) => storage.saveGarden(d) },
    { col: COLLECTIONS.TASKS, save: (d) => storage.saveTasks(d) },
    { col: COLLECTIONS.RECORDS, save: (d) => { try { wx.setStorageSync(storage.KEYS.RECORDS, d) } catch(e) {} } },
    { col: COLLECTIONS.SETTINGS, save: (d) => storage.saveSettings(d) },
    { col: COLLECTIONS.RETRO, save: (d) => {
      try {
        const map = {}
        d.forEach(item => { if (item && item.id) map[item.id] = item })
        wx.setStorageSync(storage.KEYS.RETRO, map)
      } catch(e) {}
    }}
  ]

  let restored = 0
  for (const c of collections) {
    try {
      const result = await db().collection(c.col).limit(1).get()
      if (result.data.length > 0 && result.data[0].payload) {
        c.save(result.data[0].payload)
        restored++
      }
    } catch (e) {
      console.warn(`恢复 ${c.col} 失败:`, e.message)
    }
  }

  return { success: true, restored }
}

/**
 * 单项同步触发（写入后调用，debounce 合并）
 */
function syncItem(key, getData) {
  const colMap = {
    garden: COLLECTIONS.GARDEN,
    tasks: COLLECTIONS.TASKS,
    records: COLLECTIONS.RECORDS,
    settings: COLLECTIONS.SETTINGS,
    retroCards: COLLECTIONS.RETRO
  }

  const col = colMap[key]
  if (!col) return

  debouncedSync(key, col, getData)
}

/**
 * 检查云同步状态
 */
async function getSyncStatus() {
  if (!db()) return { enabled: false }

  try {
    const meta = await getCloudMeta(COLLECTIONS.GARDEN)
    return {
      enabled: true,
      lastSync: meta ? meta.lastSync : null,
      cloudCount: meta ? meta.count : 0
    }
  } catch (e) {
    return { enabled: false, error: e.message }
  }
}

module.exports = {
  COLLECTIONS,
  syncOnStartup,
  syncItem,
  uploadAll,
  downloadAll,
  getSyncStatus,
  incrementalSync,
  isCloudEnabled: () => CLOUD_ENABLED
}
