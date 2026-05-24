// utils/ai-identify.js — AI 植物识别

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
 * 优先：云函数(百度API) → 降级提示
 */
async function identifyImage(imagePath) {
  // 1. 云函数识别
  try {
    const base64 = await imageToBase64(imagePath)
    if (!base64) {
      return { error: '图片处理失败，请重试', imagePath }
    }

    const cloudResult = await callCloudIdentify(base64)
    if (cloudResult && cloudResult.plants && cloudResult.plants.length > 0) {
      cloudResult.plants.forEach(p => matchLocal(p))
      return { plants: cloudResult.plants, imagePath }
    }

    // 云函数返回了但没结果
    if (cloudResult && cloudResult.error) {
      return { error: cloudResult.error, imagePath }
    }
  } catch (e) {
    console.warn('云函数识别失败:', e.message)
    // 给出具体错误
    if (e.errMsg && e.errMsg.includes('cloud')) {
      return { error: '云函数未部署，请联系管理员', imagePath }
    }
  }

  // 2. 完全失败 — 不造假数据
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
        resolve(res.result)
      },
      fail: (err) => {
        console.error('云函数调用失败:', err)
        reject(err)
      }
    })
  })
}

/**
 * 匹配本地数据库
 */
function matchLocal(plant) {
  const match = plantsData.plants.find(local =>
    local.name === plant.name ||
    (local.name && plant.name && local.name.includes(plant.name)) ||
    (local.name && plant.name && plant.name.includes(local.name))
  )
  if (match) {
    plant.matched = true
    plant.localId = match.id
    plant.care = match.care
    plant.emoji = match.emoji
    plant.category = match.category
    if (match.family) plant.family = match.family
    if (match.genus) plant.genus = match.genus
  } else {
    // 没精确匹配，尝试按科属词模糊匹配
    if (!plant.family) {
      const fuzzy = plantsData.plants.find(local =>
        (local.name && plant.name && (local.name.includes(plant.name) || plant.name.includes(local.name)))
      )
      if (fuzzy && fuzzy.family) plant.family = fuzzy.family
    }
  }
}

/**
 * 图片转base64（压缩到200KB以内）
 */
function imageToBase64(path) {
  return new Promise((resolve) => {
    wx.compressImage({
      src: path,
      quality: 40,
      success: (res) => {
        readAndCheck(res.tempFilePath, resolve)
      },
      fail: () => {
        readAndCheck(path, resolve)
      }
    })
  })
}

function readAndCheck(filePath, resolve) {
  wx.getFileSystemManager().readFile({
    filePath,
    encoding: 'base64',
    success: (r) => {
      // 检查大小，base64 字符串长度 * 0.75 ≈ 原始字节
      const sizeKB = (r.data.length * 0.75) / 1024
      if (sizeKB > 4096) {
        // 超过4MB直接拒绝，云函数payload上限约5MB
        console.error('图片过大:', Math.round(sizeKB), 'KB')
        resolve(null)
        return
      }
      if (sizeKB > 800) {
        console.warn('图片较大:', Math.round(sizeKB), 'KB，云函数可能超时')
      }
      resolve(r.data)
    },
    fail: () => resolve(null)
  })
}

async function identifyFromUrl(imageUrl) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url: imageUrl,
      success: async (res) => {
        if (res.statusCode === 200) {
          const result = await identifyImage(res.tempFilePath)
          resolve(result)
        } else {
          resolve({ error: '下载图片失败' })
        }
      },
      fail: () => resolve({ error: '下载图片失败' })
    })
  })
}

module.exports = {
  identifyFromCamera,
  identifyImage,
  identifyFromUrl
}
