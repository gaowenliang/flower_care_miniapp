// app.js - 全局入口（云同步版）
const storage = require('./utils/storage')
const cloudSync = require('./utils/cloud-sync')

App({
  onLaunch() {
    // 初始化云开发
    try {
      if (wx.cloud) {
        wx.cloud.init({ traceUser: true })
        // 云同步：启动时合并云端数据
        this.cloudSync()
      }
    } catch (e) {
      console.log('云开发未启用，使用本地存储模式')
    }

    this.globalData = {}
    this.initPlantData()
  },

  async cloudSync() {
    try {
      const result = await cloudSync.syncOnStartup(storage)
      console.log('云同步结果:', result)
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

  // 保留旧接口兼容
  getMyGarden() { return storage.getGarden() },
  saveMyGarden(garden) { storage.saveGarden(garden) },
  getCareTasks() { return storage.getTasks() },
  saveCareTasks(tasks) { storage.saveTasks(tasks) },

  globalData: {
    userInfo: null
  }
})
