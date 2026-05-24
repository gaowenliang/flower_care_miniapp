// pages/identify/identify.js
const aiIdentify = require('../../utils/ai-identify')

Page({
  data: {
    photoPath: '',
    plants: [],
    error: '',
    loading: false
  },

  onLoad() {
    this.startIdentify()
  },

  async startIdentify() {
    this.setData({ loading: true, error: '', plants: [] })
    
    const result = await aiIdentify.identifyFromCamera()
    
    this.setData({ loading: false })

    if (!result) {
      this.setData({ error: '取消了拍照' })
      return
    }

    if (result.error) {
      this.setData({ error: result.error, photoPath: result.imagePath || '' })
      return
    }

    this.setData({
      photoPath: result.imagePath,
      plants: result.plants || []
    })
  },

  selectPlant(e) {
    const index = e.currentTarget.dataset.index
    const plant = this.data.plants[index]
    if (!plant) return

    // 保存识花结果到 storage，带科属信息
    const info = {
      name: plant.name,
      family: plant.family || '',
      genus: plant.genus || '',
      description: plant.description || '',
      image: plant.image || ''
    }
    wx.setStorageSync('identifiedPlant', info)
    wx.navigateTo({ url: '/pages/add-plant/add-plant' })
  },

  retry() {
    this.startIdentify()
  },

  goManual() {
    wx.switchTab({ url: '/pages/add-plant/add-plant' })
  }
})
