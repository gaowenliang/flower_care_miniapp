// cloud/functions/checkReminders/index.js
// 云函数：定时检查养护提醒（家庭模式）
// 触发器：每天早上 09:00 执行
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 分页取全
async function fetchAll(collection, query) {
  const all = []; let offset = 0
  while (true) {
    const batch = await db.collection(collection).where(query).skip(offset).limit(100).get()
    all.push(...batch.data)
    if (batch.data.length < 100) break
    offset += 100
    if (offset >= 5000) break
  }
  return all
}

exports.main = async (event) => {
  const templateId = process.env.TEMPLATE_ID
  if (!templateId) {
    return { success: false, error: 'TEMPLATE_ID 环境变量未配置，请在云开发控制台设置' }
  }

  // 以今天结束（23:59:59）为界
  const eod = new Date()
  eod.setHours(23, 59, 59, 999)
  const eodTs = eod.getTime()

  try {
    // 查询家庭模式中今天到期的任务（family_tasks 集合）
    const tasks = await fetchAll('family_tasks', {
      enabled: true,
      nextDate: _.lte(eodTs)
    })

    const results = []

    for (const task of tasks) {
      // 查关联植物
      let plantName = '植物'
      try {
        const plantRes = await db.collection('family_plants').doc(task.plantId || task.userPlantId).get()
        if (plantRes.data) {
          plantName = plantRes.data.nickname || plantRes.data.name || '植物'
          // 跳过已死亡的植物
          if (plantRes.data.dead) {
            results.push({ taskId: task._id, skipped: 'plant_dead' })
            continue
          }
        }
      } catch (e) {
        // 植物不存在，跳过
        results.push({ taskId: task._id, skipped: 'plant_not_found' })
        continue
      }

      try {
        // 查植物添加者的 openid 作为通知对象（也可改为认养者）
        const plantRes = await db.collection('family_plants').doc(task.plantId || task.userPlantId).get()
        const notifyOpenids = new Set()
        if (plantRes.data) {
          if (plantRes.data.addedBy) notifyOpenids.add(plantRes.data.addedBy)
          // 也通知认养者
          ;(plantRes.data.adopters || []).forEach(oid => notifyOpenids.add(oid))
        }

        const todayStr = new Date().toISOString().split('T')[0]
        let sent = false
        for (const openid of notifyOpenids) {
          try {
            await cloud.openapi.subscribeMessage.send({
              touser: openid,
              templateId,
              page: `pages/plant-detail/plant-detail?id=${task.plantId || task.userPlantId}`,
              data: {
                thing1: { value: plantName },
                date2: { value: todayStr },
                thing3: { value: `${task.typeName}时间到了！` }
              }
            })
            sent = true
          } catch (err) {
            // 用户未授权订阅或额度用完，静默跳过
          }
        }
        results.push({ taskId: task._id, sent })
      } catch (err) {
        results.push({ taskId: task._id, sent: false, error: err.message })
      }
    }

    return { success: true, total: tasks.length, results }
  } catch (err) {
    console.error('检查提醒失败:', err)
    return { success: false, error: err.message }
  }
}
