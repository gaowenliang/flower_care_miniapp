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
  getImageUrl
}
