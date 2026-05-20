// app.js - 全局入口（优化版）
App({
  onLaunch() {
    // 兼容：本地开发不需要云开发
    try {
      if (wx.cloud) {
        wx.cloud.init({ traceUser: true })
      }
    } catch (e) {
      console.log('云开发未启用，使用本地存储模式')
    }

    this.globalData = {}
    this.initPlantData()
  },

  initPlantData() {
    const stored = wx.getStorageSync('plantDB')
    if (!stored || stored.length === 0) {
      try {
        wx.setStorageSync('plantDB', require('./data/plants.js').plants)
      } catch (e) {
        console.error('初始化植物数据失败:', e)
      }
    }
  },

  getMyGarden() {
    return wx.getStorageSync('myGarden') || []
  },

  saveMyGarden(garden) {
    wx.setStorageSync('myGarden', garden)
  },

  getCareTasks() {
    return wx.getStorageSync('careTasks') || []
  },

  saveCareTasks(tasks) {
    wx.setStorageSync('careTasks', tasks)
  },

  globalData: {
    userInfo: null
  }
})
