// app.js - 全局入口（云同步 + 错误监控）
const storage = require('./utils/storage')
const cloudSync = require('./utils/cloud-sync')

App({
  onLaunch() {
    // 全局错误监控
    this.setupErrorMonitor()

    // 初始化云开发
    try {
      if (wx.cloud) {
        wx.cloud.init({ traceUser: true })
        this.cloudSync()
      }
    } catch (e) {
      console.debug('[app] 云开发未启用，本地模式')
    }

    this.globalData = {}
    this.initPlantData()
    storage.migrate()
  },

  // ========== 全局错误监控 ==========
  setupErrorMonitor() {
    // 捕获未处理的 Promise 拒绝
    wx.onUnhandledRejection((res) => {
      console.error('未处理的Promise拒绝:', res.reason, res.promise)
      this.reportError('unhandledRejection', res.reason)
    })

    // 捕获小程序错误
    wx.onError((error) => {
      console.error('全局错误:', error)
      this.reportError('globalError', error)
    })
  },

  // 错误上报（本地记录，后续可接上报服务）
  reportError(type, error) {
    try {
      const errors = wx.getStorageSync('errorLog') || []
      errors.unshift({
        type,
        error: String(error).substring(0, 500),
        time: Date.now(),
        page: getCurrentPages().length > 0 ? getCurrentPages()[getCurrentPages().length - 1].route : 'unknown'
      })
      // 只保留最近50条
      if (errors.length > 50) errors.length = 50
      wx.setStorageSync('errorLog', errors)
    } catch (e) {
      // 静默失败
    }
  },

  async cloudSync() {
    try {
      const result = await cloudSync.syncOnStartup(storage)
      console.debug('[app] 云同步完成:', result)
    } catch (e) {
      console.warn('云同步失败，使用本地数据:', e)
    }
  },

  initPlantData() {
    try {
      const stored = wx.getStorageSync('plantDB')
      if (!stored || stored.length === 0) {
        wx.setStorageSync('plantDB', require('./data/plants.js').plants)
      }
    } catch (e) {
      console.error('初始化植物数据失败:', e)
    }
  },

  globalData: {
    userInfo: null
  }
})
