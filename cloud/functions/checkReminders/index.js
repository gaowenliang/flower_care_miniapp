// cloud/functions/checkReminders/index.js
// 云函数：定时检查养护提醒（带鉴权）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()
  const tomorrowTime = todayTime + 86400000

  try {
    // 查询所有到期任务
    const { data: tasks } = await db.collection('care_tasks')
      .where({
        enabled: true,
        nextDate: db.command.lte(tomorrowTime)
      })
      .limit(100)
      .get()

    const results = []

    for (const task of tasks) {
      const { data: plant } = await db.collection('user_plants')
        .where({ _id: task.userPlantId })
        .get()

      if (!plant || plant.length === 0) continue

      try {
        await cloud.openapi.subscribeMessage.send({
          touser: plant[0]._openid,
          templateId: process.env.TEMPLATE_ID || 'YOUR_WATER_TEMPLATE_ID',
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
