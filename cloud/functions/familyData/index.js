// cloud/functions/familyData/index.js
// 云函数：家庭数据操作（植物CRUD、记录、任务）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  // 获取用户所在家庭的 familyId
  async function getFamilyId() {
    const res = await db.collection('family_members').where({ openid: OPENID }).limit(1).get()
    if (res.data.length === 0) return null
    return res.data[0].familyId
  }

  // 获取用户角色
  async function getRole(familyId) {
    const res = await db.collection('family_members').where({ openid: OPENID, familyId }).limit(1).get()
    if (res.data.length === 0) return null
    return res.data[0].role
  }

  switch (action) {
    case 'getPlants': return await getPlants(OPENID, await getFamilyId())
    case 'addPlant': return await addPlant(event, OPENID, await getFamilyId())
    case 'deletePlant': return await deletePlant(event, OPENID, await getFamilyId(), await getRole(await getFamilyId()))
    case 'updatePlant': return await updatePlant(event, OPENID, await getFamilyId())
    case 'getTasks': return await getTasks(event, await getFamilyId())
    case 'addTask': return await addTask(event, OPENID, await getFamilyId())
    case 'completeTask': return await completeTask(event, OPENID, await getFamilyId())
    case 'getRecords': return await getRecords(event, await getFamilyId())
    case 'addRecord': return await addRecord(event, OPENID, await getFamilyId())
    case 'getDashboard': return await getDashboard(await getFamilyId())
    default: return { success: false, error: '未知操作' }
  }
}

/**
 * 获取家庭所有植物
 */
async function getPlants(openid, familyId) {
  if (!familyId) return { success: false, error: '不在家庭中' }
  const result = await db.collection('family_plants').where({ familyId }).orderBy('createdAt', 'desc').get()
  return { success: true, plants: result.data }
}

/**
 * 添加植物
 */
async function addPlant(event, openid, familyId) {
  if (!familyId) return { success: false, error: '不在家庭中' }
  const { plant } = event
  if (!plant) return { success: false, error: '缺少植物数据' }

  const now = db.serverDate()
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
      addedBy: openid,
      addedAt: Date.now(),
      createdAt: now,
      updatedAt: now
    }
  })

  // 同时创建默认养护任务
  const tasks = event.tasks || []
  for (const t of tasks) {
    await db.collection('family_tasks').add({
      data: {
        familyId,
        plantId: result._id,
        userPlantId: result._id,
        type: t.type,
        typeName: t.typeName,
        intervalDays: t.intervalDays,
        nextDate: t.nextDate,
        lastDoneDate: Date.now(),
        enabled: true,
        createdBy: openid,
        createdAt: now
      }
    })
  }

  return { success: true, plantId: result._id }
}

/**
 * 删除植物（仅管理员）
 */
async function deletePlant(event, openid, familyId, role) {
  if (!familyId) return { success: false, error: '不在家庭中' }
  if (role !== 'admin') return { success: false, error: '仅管理员可删除植物' }

  const { plantId } = event
  if (!plantId) return { success: false, error: '缺少植物ID' }

  await db.collection('family_plants').doc(plantId).remove()
  // 删除关联任务
  const tasks = await db.collection('family_tasks').where({ familyId, plantId }).get()
  for (const t of tasks.data) {
    await db.collection('family_tasks').doc(t._id).remove()
  }
  // 删除关联记录
  const records = await db.collection('family_records').where({ familyId, plantId }).get()
  for (const r of records.data) {
    await db.collection('family_records').doc(r._id).remove()
  }

  return { success: true }
}

/**
 * 更新植物信息
 */
async function updatePlant(event, openid, familyId) {
  if (!familyId) return { success: false, error: '不在家庭中' }
  const { plantId, updates } = event
  if (!plantId || !updates) return { success: false, error: '缺少参数' }

  await db.collection('family_plants').doc(plantId).update({
    data: { ...updates, updatedAt: db.serverDate() }
  })
  return { success: true }
}

/**
 * 获取家庭任务
 */
async function getTasks(event, familyId) {
  if (!familyId) return { success: false, error: '不在家庭中' }
  const { plantId } = event
  let query = { familyId }
  if (plantId) query.plantId = plantId

  const result = await db.collection('family_tasks').where(query).get()
  return { success: true, tasks: result.data }
}

/**
 * 添加养护任务
 */
async function addTask(event, openid, familyId) {
  if (!familyId) return { success: false, error: '不在家庭中' }
  const { task } = event
  if (!task) return { success: false, error: '缺少任务数据' }

  await db.collection('family_tasks').add({
    data: {
      familyId,
      plantId: task.userPlantId,
      userPlantId: task.userPlantId,
      type: task.type,
      typeName: task.typeName,
      intervalDays: task.intervalDays,
      nextDate: task.nextDate,
      lastDoneDate: Date.now(),
      enabled: true,
      createdBy: openid,
      createdAt: db.serverDate()
    }
  })
  return { success: true }
}

/**
 * 完成任务
 */
async function completeTask(event, openid, familyId) {
  if (!familyId) return { success: false, error: '不在家庭中' }
  const { taskId } = event
  if (!taskId) return { success: false, error: '缺少任务ID' }

  const taskRes = await db.collection('family_tasks').doc(taskId).get()
  const task = taskRes.data

  const nextDate = Date.now() + task.intervalDays * 86400000
  await db.collection('family_tasks').doc(taskId).update({
    data: { lastDoneDate: Date.now(), nextDate }
  })

  // 添加养护记录
  await db.collection('family_records').add({
    data: {
      familyId,
      plantId: task.plantId || task.userPlantId,
      userPlantId: task.userPlantId,
      type: task.type,
      typeName: task.typeName,
      date: Date.now(),
      note: '',
      createdBy: openid,
      createdAt: db.serverDate()
    }
  })

  return { success: true, nextDate }
}

/**
 * 获取养护记录
 */
async function getRecords(event, familyId) {
  if (!familyId) return { success: false, error: '不在家庭中' }
  const { plantId, limit } = event
  let query = { familyId }
  if (plantId) query.plantId = plantId

  const l = limit || 100
  const result = await db.collection('family_records')
    .where(query)
    .orderBy('date', 'desc')
    .limit(l)
    .get()

  return { success: true, records: result.data }
}

/**
 * 添加养护记录（拍照、备注等）
 */
async function addRecord(event, openid, familyId) {
  if (!familyId) return { success: false, error: '不在家庭中' }
  const { record } = event
  if (!record) return { success: false, error: '缺少记录数据' }

  await db.collection('family_records').add({
    data: {
      familyId,
      plantId: record.userPlantId,
      userPlantId: record.userPlantId,
      type: record.type,
      typeName: record.typeName,
      date: record.date || Date.now(),
      note: record.note || '',
      photo: record.photo || null,
      createdBy: openid,
      createdAt: db.serverDate()
    }
  })
  return { success: true }
}

/**
 * 获取首页仪表盘数据（植物 + 今日任务）
 */
async function getDashboard(familyId) {
  if (!familyId) return { success: false, error: '不在家庭中' }

  const plantsRes = await db.collection('family_plants').where({ familyId }).orderBy('createdAt', 'desc').get()
  const tasksRes = await db.collection('family_tasks').where({ familyId, enabled: true }).get()

  const plants = plantsRes.data
  const tasks = tasksRes.data

  // 计算今日到期任务
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
