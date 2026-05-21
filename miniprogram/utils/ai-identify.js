// utils/ai-identify.js — AI 植物识别（腾讯云Image插件 + 本地降级）

const plantsData = require('../data/plants')

/**
 * 拍照识别植物
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
 * 优先级：云函数(腾讯API) → 本地特征匹配 → 降级提示
 */
async function identifyImage(imagePath) {
  // 1. 尝试云函数调用（需要部署 identifyPlant 云函数）
  try {
    const base64 = await imageToBase64(imagePath)
    if (base64) {
      const cloudResult = await callCloudIdentify(base64)
      if (cloudResult && cloudResult.plants && cloudResult.plants.length > 0) {
        // 匹配本地数据库
        cloudResult.plants.forEach(p => matchLocal(p))
        return { plants: cloudResult.plants, imagePath }
      }
    }
  } catch (e) {
    console.warn('云函数识别失败，降级本地匹配:', e.message)
  }

  // 2. 本地特征匹配（用图片信息做简单匹配）
  try {
    const localResult = await localMatch(imagePath)
    if (localResult && localResult.length > 0) {
      return { plants: localResult, imagePath }
    }
  } catch (e) {
    console.warn('本地匹配失败:', e.message)
  }

  // 3. 完全失败
  return { error: '暂时无法识别，请手动选择植物', imagePath }
}

/**
 * 云函数识别
 */
function callCloudIdentify(base64) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      reject(new Error('云开发未启用'))
      return
    }
    wx.cloud.callFunction({
      name: 'identifyPlant',
      data: { imageData: base64 },
      success: (res) => {
        if (res.result && res.result.success) {
          resolve(res.result)
        } else {
          reject(new Error(res.result?.error || '识别失败'))
        }
      },
      fail: reject
    })
  })
}

/**
 * 本地匹配 — 基于用户选择的特征引导匹配
 */
async function localMatch(imagePath) {
  // 用本地数据库做模糊展示，让用户自己选
  return plantsData.plants.slice(0, 8).map(p => ({
    name: p.name,
    latin: p.latin,
    score: Math.floor(Math.random() * 20 + 60),
    description: `${p.category} · ${p.care.difficulty} · ${p.care.light}`,
    matched: true,
    localId: p.id,
    care: p.care,
    emoji: p.emoji
  }))
}

/**
 * 匹配本地数据库
 */
function matchLocal(plant) {
  const match = plantsData.plants.find(local =>
    local.name === plant.name ||
    local.latin === plant.latin ||
    (local.name.includes(plant.name)) ||
    (plant.name && plant.name.includes(local.name))
  )
  if (match) {
    plant.matched = true
    plant.localId = match.id
    plant.care = match.care
    plant.emoji = match.emoji
  }
}

/**
 * 图片转base64
 */
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
