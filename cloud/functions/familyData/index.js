// cloud/functions/familyData/index.js
// 云函数：家庭数据操作（植物CRUD、记录、任务、认养、加分）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 积分规则（与 familyManage 保持一致，修改时同步）
const POINT_RULES = {
  water: 2, fertilize: 3, prune: 4, repot: 5, spray: 3,
  photo: 1, note: 1, retro: 2, custom: 1
}

// 分页取全（微信云函数单次上限100条）
async function fetchAll(collection, query) {
  const all = []; let offset = 0
  while (true) {
    const batch = await db.collection(collection).where(query).skip(offset).limit(100).get()
    all.push(...batch.data)
    if (batch.data.length < 100) break
    offset += 100; if (offset >= 5000) break
  }
  return all
}

async function getFamilyId(openid) {
  const res = await db.collection('family_members').where({ openid }).limit(1).get()
  if (res.data.length === 0) return null
  return res.data[0].familyId
}

async function getMemberNickname(openid) {
  const res = await db.collection('family_members').where({ openid }).limit(1).get()
  return res.data.length > 0 ? (res.data[0].nickname || '成员') : '成员'
}

async function addPointsToMember(openid, type) {
  const points = POINT_RULES[type] || 1
  const memberRes = await db.collection('family_members').where({ openid }).limit(1).get()
  if (memberRes.data.length === 0) return
  await db.collection('family_members').doc(memberRes.data[0]._id).update({
    data: { points: _.inc(points), totalCare: _.inc(1) }
  })
}

// 写动态
async function logActivity(familyId, openid, type, content) {
  const nickname = await getMemberNickname(openid)
  await db.collection('family_activities').add({
    data: { familyId, openid, nickname, type, content, createdAt: Date.now() }
  })
}

// 植物名工具
async function getPlantName(plantId) {
  try {
    const res = await db.collection('family_plants').doc(plantId).get()
    return res.data ? (res.data.nickname || res.data.name || '植物') : '植物'
  } catch (e) { return '植物' }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  // 前端 callCloud 统一发送 { action, data }，把 data 展开到 event 上供子函数读取
  if (event.data && typeof event.data === 'object') {
    Object.assign(event, event.data)
  }

  const familyId = await getFamilyId(OPENID)
  if (!familyId) return { success: false, error: '不在家庭中' }

  switch (action) {
    case 'getPlants': return await getPlants(familyId)
    case 'addPlant': return await addPlant(event, OPENID, familyId)
    case 'deletePlant': return await deletePlant(event, OPENID, familyId)
    case 'updatePlant': return await updatePlant(event, OPENID, familyId)
    case 'getTasks': return await getTasks(event, familyId)
    case 'addTask': return await addTask(event, OPENID, familyId)
    case 'completeTask': return await completeTask(event, OPENID, familyId)
    case 'updateTask': return await updateTask(event, OPENID, familyId)
    case 'toggleTask': return await toggleTask(event, OPENID, familyId)
    case 'getRecords': return await getRecords(event, familyId)
    case 'addRecord': return await addRecord(event, OPENID, familyId)
    case 'deleteRecord': return await deleteRecord(event, OPENID, familyId)
    case 'batchImportRecords': return await batchImportRecords(event, OPENID, familyId)
    case 'getDashboard': return await getDashboard(familyId)
    default: return { success: false, error: '未知操作' }
  }
}

/**
 * 获取家庭所有植物（含认养者信息）
 */
async function getPlants(familyId) {
  const plants = await fetchAll('family_plants', { familyId })
  plants.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))

  // 只查有认养者的 openid
  const adopterSets = new Set()
  plants.forEach(p => (p.adopters || []).forEach(oid => adopterSets.add(oid)))

  let memberMap = {}
  if (adopterSets.size > 0) {
    const membersRes = await db.collection('family_members')
      .where({ familyId, openid: _.in([...adopterSets]) })
      .get()
    membersRes.data.forEach(m => { memberMap[m.openid] = m })
  }

  const enrichedPlants = plants.map(p => ({
    ...p,
    adopterNames: (p.adopters || []).map(oid => (memberMap[oid] || {}).nickname || '成员')
  }))

  return { success: true, plants: enrichedPlants }
}

/**
 * 添加植物
 */
async function addPlant(event, openid, familyId) {
  const { plant, tasks } = event
  if (!plant) return { success: false, error: '缺少植物数据' }

  const now = Date.now()
  const result = await db.collection('family_plants').add({
    data: {
      familyId,
      plantId: plant.plantId || '',
      name: plant.name || '',
      latin: plant.latin || '',
      family: plant.family || '',
      emoji: plant.emoji || '🌱',
      category: plant.category || '',
      nickname: plant.nickname || plant.name || '',
      location: plant.location || '阳台',
      photo: plant.photo || null,
      avatar: plant.avatar || null,
      purchasePrice: plant.price || plant.purchasePrice || 0,
      purchaseDate: plant.purchaseDate || null,
      purchaseSource: plant.purchaseSource || '',
      addedBy: openid,
      addedAt: now,
      createdAt: now,
      updatedAt: now,
      adopters: [] // 认养者列表
    }
  })

  const defaultTasks = tasks || [
    { type: 'water', typeName: '浇水', intervalDays: plant.waterDays || 7 },
    { type: 'fertilize', typeName: '施肥', intervalDays: 30 },
    { type: 'prune', typeName: '修剪', intervalDays: 60 }
  ]
  for (const t of defaultTasks) {
    await db.collection('family_tasks').add({
      data: {
        familyId,
        plantId: result._id,
        userPlantId: result._id,
        type: t.type,
        typeName: t.typeName,
        intervalDays: t.intervalDays,
        nextDate: now + t.intervalDays * 86400000,
        lastDoneDate: now,
        enabled: true,
        createdBy: openid,
        createdAt: now
      }
    })
  }

  return { success: true, plantId: result._id }
}

/**
 * 删除植物（仅管理员或添加者）
 */
async function deletePlant(event, openid, familyId) {
  const { plantId } = event
  if (!plantId) return { success: false, error: '缺少植物ID' }

  const plantRes = await db.collection('family_plants').doc(plantId).get()
  if (!plantRes.data || plantRes.data.familyId !== familyId) return { success: false, error: '植物不存在' }

  // 检查权限
  const memberRes = await db.collection('family_members').where({ openid, familyId }).limit(1).get()
  const member = memberRes.data[0]
  if (member.role !== 'admin' && plantRes.data.addedBy !== openid) {
    return { success: false, error: '仅管理员或添加者可删除' }
  }

  // 清理认养关系
  const adopters = plantRes.data.adopters || []
  for (const oid of adopters) {
    try {
      const mRes = await db.collection('family_members').where({ openid: oid, familyId }).limit(1).get()
      if (mRes.data.length > 0) {
        const adoptedPlants = (mRes.data[0].adoptedPlants || []).filter(pid => pid !== plantId)
        await db.collection('family_members').doc(mRes.data[0]._id).update({ data: { adoptedPlants } })
      }
    } catch (e) {}
  }

  await db.collection('family_plants').doc(plantId).remove()

  // 删除关联任务
  const tasks = await fetchAll('family_tasks', { familyId, plantId })
  for (const t of tasks) await db.collection('family_tasks').doc(t._id).remove()

  const records = await fetchAll('family_records', { familyId, plantId })
  for (const r of records) await db.collection('family_records').doc(r._id).remove()

  return { success: true }
}

/**
 * 更新植物信息
 */
async function updatePlant(event, openid, familyId) {
  const { plantId, updates } = event
  if (!plantId || !updates) return { success: false, error: '缺少参数' }

  // 白名单：只允许更新这些字段
  const allowed = ['nickname', 'location', 'emoji', 'avatar', 'photo', 'purchasePrice', 'purchaseDate', 'purchaseSource', 'family', 'genus', 'latin', 'category', 'dead', 'deadAt', '_prevLocation', 'addedAt']
  const safe = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) safe[key] = updates[key]
  }

  await db.collection('family_plants').doc(plantId).update({
    data: { ...safe, updatedAt: Date.now() }
  })
  return { success: true }
}

/**
 * 获取家庭任务
 */
async function getTasks(event, familyId) {
  const { plantId } = event
  let query = { familyId }
  if (plantId) query.plantId = plantId

  const tasks = await fetchAll('family_tasks', query)
  return { success: true, tasks }
}

/**
 * 添加养护任务
 */
async function addTask(event, openid, familyId) {
  const { task } = event
  if (!task) return { success: false, error: '缺少任务数据' }

  const now = Date.now()
  await db.collection('family_tasks').add({
    data: {
      familyId,
      plantId: task.userPlantId,
      userPlantId: task.userPlantId,
      type: task.type,
      typeName: task.typeName,
      intervalDays: task.intervalDays,
      nextDate: task.nextDate || now + task.intervalDays * 86400000,
      lastDoneDate: now,
      enabled: true,
      createdBy: openid,
      createdAt: now
    }
  })
  return { success: true }
}

/**
 * 完成任务（加分+记录）
 */
async function completeTask(event, openid, familyId) {
  const { taskId, note } = event
  if (!taskId) return { success: false, error: '缺少任务ID' }

  const taskRes = await db.collection('family_tasks').doc(taskId).get()
  const task = taskRes.data
  if (!task || task.familyId !== familyId) return { success: false, error: '任务不存在' }

  const now = Date.now()
  const nextDate = now + task.intervalDays * 86400000

  await db.collection('family_tasks').doc(taskId).update({
    data: { lastDoneDate: now, nextDate }
  })

  // 添加养护记录
  await db.collection('family_records').add({
    data: {
      familyId,
      plantId: task.plantId || task.userPlantId,
      userPlantId: task.userPlantId,
      type: task.type,
      typeName: task.typeName,
      date: now,
      note: note || '',
      createdBy: openid,
      creatorNickname: '',
      createdAt: now
    }
  })

  // 加分 + 写动态 + 里程碑并行
  const plantName = await getPlantName(task.plantId || task.userPlantId)
  await Promise.all([
    addPointsToMember(openid, task.type),
    logActivity(familyId, openid, 'care', `${task.typeName}了「${plantName}」`)
  ])

  // 里程碑检测（异步不阻塞）
  checkMilestonesAsync(familyId, task.plantId || task.userPlantId)

  return { success: true, nextDate }
}

/**
 * 异步里程碑检测（不阻塞主流程）
 */
async function checkMilestonesAsync(familyId, plantId) {
  const MILESTONES = [
    { id: 'days_7', name: '🌱 一周纪念', check: (p) => p.addedAt && (Date.now() - p.addedAt) >= 7 * 86400000 },
    { id: 'days_30', name: '🌿 一个月', check: (p) => p.addedAt && (Date.now() - p.addedAt) >= 30 * 86400000 },
    { id: 'days_100', name: '🌳 百日纪念', check: (p) => p.addedAt && (Date.now() - p.addedAt) >= 100 * 86400000 },
    { id: 'days_365', name: '🏆 一周年', check: (p) => p.addedAt && (Date.now() - p.addedAt) >= 365 * 86400000 },
  ]
  try {
    const plantRes = await db.collection('family_plants').doc(plantId).get()
    const plant = plantRes.data
    if (!plant) return
    for (const m of MILESTONES) {
      if (!m.check(plant)) continue
      const existRes = await db.collection('family_milestones').where({ familyId, plantId, milestoneId: m.id }).limit(1).get()
      if (existRes.data.length > 0) continue
      await db.collection('family_milestones').add({
        data: { familyId, plantId, milestoneId: m.id, name: m.name, plantName: plant.nickname || plant.name, createdAt: Date.now() }
      })
      await logActivity(familyId, 'system', 'milestone', `「${plant.nickname || plant.name}」达成 ${m.name}！🎉`)
    }
  } catch (e) { /* 不阻塞主流程 */ }
}

/**
 * 更新任务
 */
async function updateTask(event, openid, familyId) {
  const { taskId, updates } = event
  if (!taskId || !updates) return { success: false, error: '缺少参数' }

  const taskRes = await db.collection('family_tasks').doc(taskId).get()
  if (!taskRes.data || taskRes.data.familyId !== familyId) return { success: false, error: '任务不存在' }

  const allowed = ['intervalDays', 'enabled', 'typeName', 'nextDate']
  const safe = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) safe[key] = updates[key]
  }
  if (safe.intervalDays) {
    safe.nextDate = (taskRes.data.lastDoneDate || Date.now()) + safe.intervalDays * 86400000
    if (safe.nextDate < Date.now()) {
      safe.nextDate = Date.now() + safe.intervalDays * 86400000
    }
  }

  await db.collection('family_tasks').doc(taskId).update({ data: safe })
  return { success: true }
}

/**
 * 切换任务启用
 */
async function toggleTask(event, openid, familyId) {
  const { taskId } = event
  if (!taskId) return { success: false, error: '缺少任务ID' }

  const taskRes = await db.collection('family_tasks').doc(taskId).get()
  if (!taskRes.data || taskRes.data.familyId !== familyId) return { success: false, error: '任务不存在' }

  await db.collection('family_tasks').doc(taskId).update({
    data: { enabled: !taskRes.data.enabled }
  })
  return { success: true, enabled: !taskRes.data.enabled }
}

/**
 * 获取养护记录（含操作者昵称）
 */
async function getRecords(event, familyId) {
  const { plantId, limit } = event
  let query = { familyId }
  if (plantId) query.plantId = plantId

  // 使用 fetchAll 分页获取全部记录（解决超过100条时2025年数据被截断的问题）
  const allRecords = await fetchAll('family_records', query)

  // 按日期倒序
  allRecords.sort((a, b) => (b.date || 0) - (a.date || 0))

  // 如果传了 limit 就截取，兜底上限 500 防滥用
  const l = limit || 500
  const records = allRecords.slice(0, Math.min(l, 500))

  // 获取成员信息映射
  const openids = new Set(records.map(r => r.createdBy).filter(Boolean))
  let memberMap = {}
  if (openids.size > 0) {
    const membersRes = await db.collection('family_members').where({ familyId }).get()
    membersRes.data.forEach(m => { memberMap[m.openid] = m })
  }

  const enrichedRecords = records.map(r => ({
    ...r,
    creatorNickname: r.creatorNickname || (memberMap[r.createdBy] || {}).nickname || '成员'
  }))

  return { success: true, records: enrichedRecords }
}

/**
 * 添加养护记录（拍照、备注等，加分）
 */
async function addRecord(event, openid, familyId) {
  const { record } = event
  if (!record) return { success: false, error: '缺少记录数据' }

  // 校验 plantId 归属该家庭
  const targetPlantId = record.userPlantId || record.plantId
  if (targetPlantId) {
    try {
      const plantRes = await db.collection('family_plants').doc(targetPlantId).get()
      if (!plantRes.data || plantRes.data.familyId !== familyId) {
        return { success: false, error: '植物不存在或无权限' }
      }
    } catch (e) {
      return { success: false, error: '植物不存在' }
    }
  }

  // 获取昵称
  const memberRes = await db.collection('family_members').where({ openid, familyId }).limit(1).get()
  const nickname = memberRes.data.length > 0 ? memberRes.data[0].nickname : ''

  const now = Date.now()
  await db.collection('family_records').add({
    data: {
      familyId,
      plantId: record.userPlantId || record.plantId || '',
      userPlantId: record.userPlantId || '',
      type: record.type || 'custom',
      typeName: record.typeName || '养护',
      date: record.date || now,
      note: record.note || '',
      photo: record.photo || null,
      cost: record.cost || 0,
      createdBy: openid,
      creatorNickname: nickname,
      createdAt: now
    }
  })

  // 加分 + 写动态并行
  const plantName = await getPlantName(record.userPlantId || record.plantId)
  const actionText = record.type === 'photo' ? `给「${plantName}」拍了照片` : record.type === 'note' ? `给「${plantName}」写了备注` : `${record.typeName || '养护'}了「${plantName}」`
  await Promise.all([
    addPointsToMember(openid, record.type || 'custom'),
    logActivity(familyId, openid, record.type || 'care', actionText)
  ])

  return { success: true }
}

/**
 * 删除记录
 */
async function deleteRecord(event, openid, familyId) {
  const { recordId } = event
  if (!recordId) return { success: false, error: '缺少记录ID' }

  const recRes = await db.collection('family_records').doc(recordId).get()
  if (!recRes.data || recRes.data.familyId !== familyId) return { success: false, error: '记录不存在' }

  const memberRes = await db.collection('family_members').where({ openid, familyId }).limit(1).get()
  const member = memberRes.data[0]
  if (member.role !== 'admin' && recRes.data.createdBy !== openid) {
    return { success: false, error: '只能删除自己的记录' }
  }

  await db.collection('family_records').doc(recordId).remove()
  return { success: true }
}

/**
 * 获取首页仪表盘
 */
async function getDashboard(familyId) {
  const plants = await fetchAll('family_plants', { familyId })
  plants.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
  const tasks = await fetchAll('family_tasks', { familyId, enabled: true })

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTs = today.getTime()
  const dueTasks = tasks.filter(t => t.nextDate <= todayTs + 86400000)

  return {
    success: true,
    plants,
    tasks,
    dueTasks: dueTasks.map(t => {
      const plant = plants.find(p => p._id === (t.plantId || t.userPlantId))
      return {
        ...t,
        plantName: plant ? plant.nickname : '未知植物',
        plantEmoji: plant ? plant.emoji : '🌱',
        id: t._id
      }
    })
  }
}

/**
 * 批量导入养护记录（带查重防刷分）
 * 接收：{ records: [{type, typeName, date, note}], plantId }
 * 返回：{ success: true, imported: N, skipped: M }
 */
async function batchImportRecords(event, openid, familyId) {
  const { records, plantId, createdBy } = event
  if (!records || !Array.isArray(records) || records.length === 0) {
    return { success: false, error: '缺少记录数据' }
  }
  if (!plantId) {
    return { success: false, error: '缺少植物 ID' }
  }

  // 实际操作人（如果前端传了 createdBy 就用前端的，否则用当前用户）
  const operatorOpenid = createdBy || openid

  // 安全校验：createdBy 只能是本人或家庭成员
  if (createdBy && createdBy !== openid) {
    const targetMember = await db.collection('family_members').where({ openid: createdBy, familyId }).limit(1).get()
    if (targetMember.data.length === 0) {
      return { success: false, error: '指定的养护人不在家庭中' }
    }
  }

  // 校验 plantId 归属该家庭
  try {
    const plantRes = await db.collection('family_plants').doc(plantId).get()
    if (!plantRes.data || plantRes.data.familyId !== familyId) {
      return { success: false, error: '植物不存在或无权限' }
    }
  } catch (e) {
    return { success: false, error: '植物不存在' }
  }

  // 获取操作人昵称
  const memberRes = await db.collection('family_members').where({ openid: operatorOpenid, familyId }).limit(1).get()
  const nickname = memberRes.data.length > 0 ? memberRes.data[0].nickname : ''

  // 查出该 plantId 已有记录（用于覆盖）
  const existing = await fetchAll('family_records', { familyId, plantId })
  // 用 map 存已有记录，key = type_日期天
  const existMap = new Map()
  existing.forEach(r => {
    const key = `${r.type}_${Math.floor(r.date / 86400000)}`
    existMap.set(key, r)
  })

  const toInsert = []
  const toUpdate = []
  const seenKeys = new Set()

  for (const r of records) {
    const dateTs = r.date
    const dayKey = Math.floor(dateTs / 86400000)
    const key = `${r.type}_${dayKey}`

    if (seenKeys.has(key)) continue // 批量内去重
    seenKeys.add(key)

    const rec = {
      type: r.type || 'custom',
      typeName: r.typeName || '养护',
      date: dateTs,
      note: r.note || '',
      createdBy: operatorOpenid,
      creatorNickname: nickname,
      createdAt: Date.now()
    }

    if (existMap.has(key)) {
      // 重复记录 → 覆盖更新
      const old = existMap.get(key)
      toUpdate.push({ id: old._id, data: rec })
    } else {
      toInsert.push({
        ...rec,
        familyId,
        plantId,
        userPlantId: plantId
      })
    }
  }

  // 分批插入新记录（每批20条，避免云开发限流）
  const BATCH_SIZE = 20
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    await Promise.all(toInsert.slice(i, i + BATCH_SIZE).map(rec =>
      db.collection('family_records').add({ data: rec })
    ))
  }

  // 分批覆盖旧记录
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    await Promise.all(toUpdate.slice(i, i + BATCH_SIZE).map(u =>
      db.collection('family_records').doc(u.id).update({ data: u.data })
    ))
  }

  // 加分并行（只给新插入的加，覆盖的不重复加）
  if (toInsert.length > 0) {
    await Promise.all(toInsert.map(rec => addPointsToMember(operatorOpenid, rec.type).catch(e => console.error('加分失败:', e))))
  }

  // 汇总写一条动态
  const totalCount = toInsert.length + toUpdate.length
  if (totalCount > 0) {
    const plantName = await getPlantName(plantId)
    const actionNames = [...new Set([...toInsert, ...toUpdate].map(r => r.typeName))]
    const content = `从截图导入了 ${totalCount} 条养护记录到「${plantName}」：${actionNames.join('、')}`
    await logActivity(familyId, openid, 'import', content)
  }

  return {
    success: true,
    imported: toInsert.length,
    updated: toUpdate.length,
    total: totalCount
  }
}
