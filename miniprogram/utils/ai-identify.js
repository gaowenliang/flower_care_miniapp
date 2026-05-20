// utils/ai-identify.js — AI 植物识别

const plantsData = require('../data/plants')

/**
 * 拍照识别植物
 * @returns {Promise<Object|null>} 识别结果
 */
function identifyFromCamera() {
  return new Promise((resolve) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        identifyImage(tempPath).then(resolve)
      },
      fail: () => resolve(null)
    })
  })
}

/**
 * 识别图片中的植物
 * @param {string} imagePath 本地图片路径
 */
async function identifyImage(imagePath) {
  // 读取图片转base64
  const base64 = await imageToBase64(imagePath)
  if (!base64) return null

  // 调云函数
  try {
    const res = await new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'identifyPlant',
        data: { imageData: base64 },
        success: resolve,
        fail: reject
      })
    })

    if (res.result && res.result.success) {
      const plants = res.result.plants
      // 尝试匹配本地数据库
      plants.forEach(p => {
        const match = plantsData.plants.find(local =>
          local.name === p.name || local.latin === p.name
        )
        if (match) {
          p.matched = true
          p.localId = match.id
          p.care = match.care
          p.emoji = match.emoji
        }
      })
      return { plants, imagePath }
    }

    return { error: res.result?.error || '识别失败', imagePath }
  } catch (e) {
    // 云函数失败时降级：本地模糊匹配
    return { error: 'AI服务暂不可用，请手动选择植物', imagePath, fallback: true }
  }
}

function imageToBase64(path) {
  return new Promise((resolve) => {
    wx.getFileSystemManager().readFile({
      filePath: path,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: () => resolve(null)
    })
  })
}

module.exports = {
  identifyFromCamera,
  identifyImage
}
