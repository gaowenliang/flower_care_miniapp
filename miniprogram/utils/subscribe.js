// utils/subscribe.js - 订阅消息管理

/**
 * 养花助手订阅消息模板
 * 需要在微信公众平台申请模板，获取 templateId
 * 
 * 申请路径：微信公众平台 → 功能 → 订阅消息 → 公共模板库
 * 推荐模板：
 * - 浇水提醒：thing1(植物名称) + date2(提醒时间) + thing3(备注)
 */

const SUBSCRIBE_TEMPLATES = {
  // 浇水提醒模板 - 需替换为实际申请到的模板ID
  WATER_REMINDER: 'YOUR_WATER_TEMPLATE_ID',
  // 养护任务提醒
  CARE_REMINDER: 'YOUR_CARE_TEMPLATE_ID'
}

/**
 * 请求订阅消息授权
 * @param {string} templateId 模板ID
 * @returns {Promise<boolean>} 用户是否同意
 */
function requestSubscribe(templateId) {
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: (res) => {
        if (res[templateId] === 'accept') {
          console.log('用户同意订阅')
          resolve(true)
        } else {
          console.log('用户拒绝订阅')
          resolve(false)
        }
      },
      fail: (err) => {
        console.error('订阅消息请求失败:', err)
        resolve(false)
      }
    })
  })
}

/**
 * 发送养护提醒（通过云函数）
 * @param {string} openid 用户openid
 * @param {object} data 消息数据
 */
async function sendCareReminder(openid, data) {
  try {
    const res = await wx.cloud.callFunction({
      name: 'sendMessage',
      data: {
        openid,
        templateId: SUBSCRIBE_TEMPLATES.WATER_REMINDER,
        page: `pages/plant-detail/plant-detail?id=${data.plantId}`,
        data: {
          thing1: { value: data.plantName },
          date2: { value: data.date },
          thing3: { value: data.note }
        }
      }
    })
    return res.result
  } catch (err) {
    console.error('发送提醒失败:', err)
    return null
  }
}

/**
 * 检查并发送今日到期提醒
 * 在用户打开小程序时调用
 */
async function checkAndNotify(force) {
  const storage = require('./storage')
  const util = require('./util')
  
  const garden = storage.getGarden()
  const dueTasks = storage.getDueTasks()

  if (dueTasks.length === 0) return

  const plantNames = []
  dueTasks.forEach(task => {
    const plant = garden.find(p => p.id === task.userPlantId)
    if (plant) {
      plantNames.push(`${plant.nickname}需要${task.typeName}`)
    }
  })

  if (plantNames.length > 0) {
    wx.showToast({
      title: plantNames[0] + (plantNames.length > 1 ? `等${plantNames.length}项` : ''),
      icon: 'none',
      duration: 3000
    })
  }

  // 请求订阅授权（force=true时忽略每日限制）
  const subscribeState = wx.getStorageSync('subscribeState') || {}
  const today = util.formatDate(Date.now())
  if (force || subscribeState.lastAskDate !== today) {
    const accepted = await requestSubscribe(SUBSCRIBE_TEMPLATES.WATER_REMINDER)
    wx.setStorageSync('subscribeState', {
      lastAskDate: today,
      accepted
    })
  }
}

module.exports = {
  SUBSCRIBE_TEMPLATES,
  requestSubscribe,
  sendCareReminder,
  checkAndNotify
}
