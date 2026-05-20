// app.js
App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        traceUser: true,
      })
    }
    this.globalData = {}
    this.initPlantData()
  },

  // 初始化本地植物数据库
  initPlantData() {
    const stored = wx.getStorageSync('plantDB')
    if (!stored) {
      wx.setStorageSync('plantDB', require('./data/plants.js').plants)
    }
  },

  // 获取用户花园
  getMyGarden() {
    return wx.getStorageSync('myGarden') || []
  },

  // 保存用户花园
  saveMyGarden(garden) {
    wx.setStorageSync('myGarden', garden)
  },

  // 获取养护任务
  getCareTasks() {
    return wx.getStorageSync('careTasks') || []
  },

  // 保存养护任务
  saveCareTasks(tasks) {
    wx.setStorageSync('careTasks', tasks)
  },

  globalData: {
    userInfo: null
  }
})
