// pages/add-plant/add-plant.js - 统一走 StorageManager
const util = require('../../utils/util')
const storage = require('../../utils/storage')
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

  takePhoto() {
    wx.navigateTo({ url: '/pages/identify/identify' })
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

  async confirmAdd() {
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

    storage.addPlant(userPlant)

    // 自动创建多个养护任务
    const defaultTasks = [
      { type: 'water', typeName: '浇水', days: plant.care.waterDays },
      { type: 'fertilize', typeName: '施肥', days: 30 },
      { type: 'prune', typeName: '修剪', days: 60 }
    ]
    defaultTasks.forEach(t => {
      storage.addTask({
        id: util.genId(),
        userPlantId: userPlant.id,
        type: t.type,
        typeName: t.typeName,
        intervalDays: t.days,
        nextDate: util.nextCareDate(Date.now(), t.days),
        lastDoneDate: Date.now(),
        enabled: true
      })
    })

    this.setData({ showModal: false })
    wx.showToast({ title: '添加成功! 🎉', icon: 'none' })

    // 检查成就
    const achievement = require('../../utils/achievement')
    const newBadges = achievement.checkAchievements()
    if (newBadges.length > 0) {
      setTimeout(() => {
        wx.showToast({ title: `🏆 解锁：${newBadges[0].name}`, icon: 'none', duration: 3000 })
      }, 1500)
    }

    setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 800)
  },

  closeModal() {
    this.setData({ showModal: false })
  },

  preventBubble() {
    // 阻止事件冒泡到 modal-mask
  }
})
