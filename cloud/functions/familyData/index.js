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
  const allowed = ['nickname', 'location', 'emoji', 'avatar', 'photo', 'purchasePrice', 'purchaseDate', 'purchaseSource', 'family', 'genus', 'latin', 'category', 'dead', 'deadAt', '_prevLocation']
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
  const { taskId } = event
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
      note: '',
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

  const allowed = ['intervalDays', 'enabled', 'typeName']
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

  const l = Math.min(limit || 100, 100)
  const result = await db.collection('family_records')
    .where(query)
    .orderBy('date', 'desc')
    .limit(l)
    .get()

  // 获取成员信息映射
  const openids = new Set(result.data.map(r => r.createdBy).filter(Boolean))
  let memberMap = {}
  if (openids.size > 0) {
    const membersRes = await db.collection('family_members').where({ familyId }).get()
    membersRes.data.forEach(m => { memberMap[m.openid] = m })
  }

  const enrichedRecords = result.data.map(r => ({
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
