// cloud/functions/sendMessage/index.js
// 云函数：发送订阅消息（带鉴权）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  // 只允许给自己发消息
  if (event.openid && event.openid !== OPENID) {
    return { success: false, error: '无权发送给其他用户' }
  }

  const { templateId, page, data } = event

  if (!templateId || !data) {
    return { success: false, error: '缺少 templateId 或 data' }
  }

  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: OPENID,
      templateId,
      page: page || '',
      data,
      miniprogramState: 'formal'
    })
    return { success: true, msgId: result.msgId }
  } catch (err) {
    console.error('发送订阅消息失败:', err)
    return { success: false, error: err.message }
  }
}
