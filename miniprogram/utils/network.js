// utils/network.js — 网络状态检测与兜底

/**
 * 检查网络是否可用
 */
function checkNetwork() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: (res) => {
        resolve(res.networkType !== 'none')
      },
      fail: () => resolve(false)
    })
  })
}

/**
 * 带重试的安全网络请求
 * @param {object} options wx.request 参数
 * @param {number} retries 重试次数
 */
function safeRequest(options, retries = 2) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      wx.request({
        ...options,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res)
          } else if (remaining > 0) {
            setTimeout(() => attempt(remaining - 1), 1000)
          } else {
            reject(new Error(`HTTP ${res.statusCode}`))
          }
        },
        fail: (err) => {
          if (remaining > 0) {
            setTimeout(() => attempt(remaining - 1), 1500)
          } else {
            reject(err)
          }
        }
      })
    }
    attempt(retries)
  })
}

/**
 * 显示网络错误提示
 */
function showNetworkError() {
  wx.showToast({
    title: '网络不给力，请稍后重试',
    icon: 'none',
    duration: 2000
  })
}

module.exports = {
  checkNetwork,
  safeRequest,
  showNetworkError
}
