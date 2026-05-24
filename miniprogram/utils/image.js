// utils/image.js - 图片持久化（云存储上传 + 自动压缩）

/**
 * 压缩图片到指定尺寸和质量
 * @param {string} tempFilePath 临时文件路径
 * @param {number} quality 压缩质量 0-100
 */
function compressImage(tempFilePath, quality = 80) {
  return new Promise((resolve) => {
    wx.compressImage({
      src: tempFilePath,
      quality,
      success: (res) => resolve(res.tempFilePath),
      fail: () => resolve(tempFilePath) // 压缩失败用原图
    })
  })
}

/**
 * 上传图片到云存储，返回永久 fileID
 * 自动压缩后上传
 */
function uploadImage(tempFilePath) {
  return new Promise(async (resolve) => {
    // 先压缩
    const compressed = await compressImage(tempFilePath, 80)

    if (!wx.cloud) {
      resolve(compressed)
      return
    }

    const cloudPath = 'plant-photos/' + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '.jpg'

    wx.cloud.uploadFile({
      cloudPath,
      filePath: compressed,
      success: (res) => {
        resolve(res.fileID)
      },
      fail: () => {
        console.warn('云存储上传失败，使用本地路径')
        resolve(compressed)
      }
    })
  })
}

/**
 * 上传方形头像（自动居中裁切 + 压缩上传）
 */
async function uploadSquareAvatar(tempFilePath) {
  const squarePath = await resizeToSquare(tempFilePath, 150)
  return uploadImage(squarePath)
}

/**
 * 居中裁切为正方形并缩放到指定尺寸
 */
function resizeToSquare(tempFilePath, maxSize) {
  return new Promise((resolve) => {
    wx.getImageInfo({
      src: tempFilePath,
      success: (info) => {
        const { width, height } = info
        const s = Math.min(width, height)
        const sx = (width - s) / 2
        const sy = (height - s) / 2

        try {
          const canvas = wx.createOffscreenCanvas({ type: '2d', width: maxSize, height: maxSize })
          const ctx = canvas.getContext('2d')
          const img = canvas.createImage()
          img.onload = () => {
            ctx.drawImage(img, sx, sy, s, s, 0, 0, maxSize, maxSize)
            try {
              const temp = canvas.toDataURL('image/jpeg', 0.5)
              // toDataURL 返回 base64，写入临时文件
              const fs = wx.getFileSystemManager()
              const tmpPath = `${wx.env.USER_DATA_PATH}/avatar_${Date.now()}.jpg`
              const base64 = temp.replace(/^data:image\/\w+;base64,/, '')
              fs.writeFileSync(tmpPath, base64, 'base64')
              resolve(tmpPath)
            } catch (e) {
              console.warn('canvas toDataURL failed, fallback to compressImage', e)
              wx.compressImage({ src: tempFilePath, quality: 50, success: r => resolve(r.tempFilePath), fail: () => resolve(tempFilePath) })
            }
          }
          img.onerror = () => {
            wx.compressImage({ src: tempFilePath, quality: 50, success: r => resolve(r.tempFilePath), fail: () => resolve(tempFilePath) })
          }
          img.src = tempFilePath
        } catch (e) {
          // createOffscreenCanvas 不支持，走压缩
          wx.compressImage({ src: tempFilePath, quality: 50, success: r => resolve(r.tempFilePath), fail: () => resolve(tempFilePath) })
        }
      },
      fail: () => resolve(tempFilePath)
    })
  })
}

/**
 * 批量上传图片
 */
async function uploadImages(tempFilePaths) {
  const promises = tempFilePaths.map(path => uploadImage(path))
  return Promise.all(promises)
}

/**
 * 获取可显示的图片路径
 */
function getImageUrl(fileID) {
  return fileID || ''
}

module.exports = {
  compressImage,
  uploadImage,
  uploadImages,
  uploadSquareAvatar,
  getImageUrl
}
