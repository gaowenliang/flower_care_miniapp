// utils/image.js - 图片持久化（云存储上传）

/**
 * 上传图片到云存储，返回永久 fileID
 * 如果云存储不可用，返回原始临时路径（降级方案）
 */
function uploadImage(tempFilePath) {
  return new Promise((resolve) => {
    // 检查是否云存储可用
    if (!wx.cloud) {
      resolve(tempFilePath)
      return
    }

    const cloudPath = 'plant-photos/' + Date.now() + '_' + Math.random().toString(36).substr(2, 8) + '.jpg'

    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success: (res) => {
        resolve(res.fileID)
      },
      fail: () => {
        // 云存储失败，降级用临时路径
        console.warn('云存储上传失败，使用本地临时路径')
        resolve(tempFilePath)
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
 * 获取可显示的图片路径（兼容 fileID 和本地路径）
 */
function getImageUrl(fileID) {
  return fileID || ''
}

module.exports = {
  uploadImage,
  uploadImages,
  getImageUrl
}
