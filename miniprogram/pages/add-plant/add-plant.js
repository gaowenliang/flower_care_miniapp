// pages/add-plant/add-plant.js - 添加植物页
const app = getApp()
const util = require('../../utils/util')
const plantsData = require('../../data/plants')

Page({
  data: {
    keyword: '',
    categories: [],
    activeCategory: 'all',
    filteredPlants: [],
    searching: false
  },

  onLoad() {
    this.setData({
      categories: plantsData.categories,
      filteredPlants: plantsData.plants
    })
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value.trim().toLowerCase()
    this.setData({ keyword, searching: keyword.length > 0 })
    this.filterPlants()
  },

  // 清空搜索
  clearSearch() {
    this.setData({ keyword: '', searching: false, activeCategory: 'all' })
    this.filterPlants()
  },

  // 切换分类
  switchCategory(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ activeCategory: id, keyword: '', searching: false })
    this.filterPlants()
  },

  // 过滤植物
  filterPlants() {
    let list = plantsData.plants
    const { keyword, activeCategory } = this.data

    if (activeCategory !== 'all') {
      list = list.filter(p => p.category === activeCategory)
    }
    if (keyword) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(keyword) ||
        p.latin.toLowerCase().includes(keyword) ||
        p.category.includes(keyword)
      )
    }
    this.setData({ filteredPlants: list })
  },

  // 拍照识别（Phase 2）
  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        wx.showToast({ title: 'AI识别功能开发中~', icon: 'none' })
        // TODO: Phase 2 - 调用植物识别API
      }
    })
  },

  // 选择植物
  selectPlant(e) {
    const plantId = e.currentTarget.dataset.id
    const plant = plantsData.plants.find(p => p.id === plantId)
    if (!plant) return

    // 弹出设置弹窗
    this.setData({ selectedPlant: plant, showModal: true })
  },

  // 确认添加
  confirmAdd() {
    const plant = this.data.selectedPlant
    if (!plant) return

    const nickname = this.data.nickName || plant.name
    const location = this.data.location || '阳台'

    // 创建用户植物
    const userPlant = {
      id: util.genId(),
      plantId: plant.id,
      name: plant.name,
      latin: plant.latin,
      emoji: plant.emoji,
      category: plant.category,
      nickname: nickname,
      location: location,
      addedAt: Date.now(),
      photo: null
    }

    // 保存到花园
    const garden = app.getMyGarden()
    garden.push(userPlant)
    app.saveMyGarden(garden)

    // 自动创建浇水任务
    const tasks = app.getCareTasks()
    tasks.push({
      id: util.genId(),
      userPlantId: userPlant.id,
      type: 'water',
      typeName: '浇水',
      intervalDays: plant.care.waterDays,
      nextDate: util.nextCareDate(Date.now(), plant.care.waterDays),
      lastDoneDate: Date.now(),
      enabled: true
    })
    app.saveCareTasks(tasks)

    wx.showToast({ title: '添加成功! 🎉', icon: 'none' })
    
    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' })
    }, 1000)
  },

  // 输入昵称
  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  // 选择位置
  selectLocation(e) {
    this.setData({ location: e.currentTarget.dataset.value })
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showModal: false })
  }
})
