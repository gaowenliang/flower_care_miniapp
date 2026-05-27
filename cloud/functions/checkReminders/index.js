// cloud/functions/checkReminders/index.js
// 云函数：定时检查养护提醒
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

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()
  const tomorrowTime = todayTime + 86400000

  try {
    // 分页查询所有到期任务（不再 limit 100 丢弃）
    const tasks = await fetchAll('care_tasks', {
      enabled: true,
      nextDate: _.lte(tomorrowTime)
    })

    const results = []

    for (const task of tasks) {
      const { data: plant } = await db.collection('user_plants')
        .where({ _id: task.userPlantId })
        .get()

      if (!plant || plant.length === 0) continue

      try {
        await cloud.openapi.subscribeMessage.send({
          touser: plant[0]._openid,
          templateId,
          page: `pages/plant-detail/plant-detail?id=${task.userPlantId}`,
          data: {
            thing1: { value: plant[0].nickname },
            date2: { value: today.toISOString().split('T')[0] },
            thing3: { value: `${task.typeName}时间到了！` }
          }
        })
        results.push({ taskId: task._id, sent: true })
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
