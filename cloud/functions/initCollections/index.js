// cloud/functions/initCollections/index.js
// 云函数：初始化云数据库集合（首次部署时调用一次）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const collections = [
    'user_plants',
    'care_tasks',
    'care_records',
    'user_settings',
    'user_achievements',
    'user_custom_rooms',
    'user_retro_cards'
  ]

  const results = []
  for (const name of collections) {
    try {
      // 尝试写入再删除来创建集合
      const res = await db.collection(name).add({ data: { _init: true } })
      await db.collection(name).doc(res._id).remove()
      results.push({ name, status: 'created' })
    } catch (e) {
      results.push({ name, status: 'exists', error: e.message })
    }
  }

  return { success: true, results }
}
