// cloud/functions/sendMessage/index.js
// 云函数：发送订阅消息
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { openid, templateId, page, data } = event

  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: templateId,
      page: page,
      data: data,
      miniprogramState: 'formal'
    })
    return { success: true, result }
  } catch (err) {
    console.error('发送订阅消息失败:', err)
    return { success: false, error: err.message }
  }
}
