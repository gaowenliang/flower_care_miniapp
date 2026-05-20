// cloud/functions/checkReminders/index.js
// 云函数：定时检查养护提醒（配合云函数定时触发器）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTime = today.getTime()

  // 查询所有到期任务
  const { data: tasks } = await db.collection('care_tasks')
    .where({
      enabled: true,
      nextDate: db.command.lte(todayTime + 86400000) // 今天或之前
    })
    .get()

  const results = []

  for (const task of tasks) {
    // 获取植物信息
    const { data: plant } = await db.collection('user_plants')
      .doc(task.userPlantId)
      .get()

    if (!plant) continue

    // 发送提醒
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: plant._openid,
        templateId: 'YOUR_WATER_TEMPLATE_ID',
        page: `pages/plant-detail/plant-detail?id=${task.userPlantId}`,
        data: {
          thing1: { value: plant.nickname },
          date2: { value: new Date().toISOString().split('T')[0] },
          thing3: { value: `${task.typeName}时间到了！` }
        }
      })
      results.push({ taskId: task._id, sent: true })
    } catch (err) {
      results.push({ taskId: task._id, sent: false, error: err.message })
    }
  }

  return { total: tasks.length, results }
}
