// pages/add-plant/add-plant.js - 优化版
const app = getApp()
const util = require('../../utils/util')
const plantsData = require('../../data/plants')

Page({
  data: {
    keyword: '',
    categories: [],
    activeCategory: 'all',
    filteredPlants: [],
    searching: false,
    showModal: false,
    selectedPlant: null,
    nickName: '',
    location: '阳台'
  },

  onLoad() {
    this.setData({
      categories: plantsData.categories,
      filteredPlants: plantsData.plants
    })
  },

  onSearchInput(e) {
    const keyword = e.detail.value.trim().toLowerCase()
    this.setData({ keyword, searching: keyword.length > 0 })
    this.filterPlants()
  },

  clearSearch() {
    this.setData({ keyword: '', searching: false, activeCategory: 'all' })
    this.filterPlants()
  },

  switchCategory(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ activeCategory: id, keyword: '', searching: false })
    this.filterPlants()
  },

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

  // 拍照识别
  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: () => {
        wx.showToast({ title: 'AI识别功能开发中~', icon: 'none' })
      }
    })
  },

  selectPlant(e) {
    const plantId = e.currentTarget.dataset.id
    const plant = plantsData.plants.find(p => p.id === plantId)
    if (!plant) return
    this.setData({ selectedPlant: plant, showModal: true, nickName: '', location: '阳台' })
  },

  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  selectLocation(e) {
    this.setData({ location: e.currentTarget.dataset.value })
  },

  confirmAdd() {
    const plant = this.data.selectedPlant
    if (!plant) return

    const nickname = this.data.nickName.trim() || plant.name
    const location = this.data.location || '阳台'

    const userPlant = {
      id: util.genId(),
      plantId: plant.id,
      name: plant.name,
      latin: plant.latin,
      emoji: plant.emoji,
      category: plant.category,
      nickname,
      location,
      addedAt: Date.now(),
      photo: null
    }

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

    this.setData({ showModal: false })
    wx.showToast({ title: '添加成功! 🎉', icon: 'none' })
    setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 800)
  },

  closeModal() {
    this.setData({ showModal: false })
  }
})
