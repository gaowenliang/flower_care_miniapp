// pages/add-plant/add-plant.js - 添加植物（含拍照识别+自定义添加+家庭模式）
const util = require('../../utils/util')
const storage = require('../../utils/storage')
const plantsData = require('../../data/plants')
const validator = require('../../utils/validator')
const family = require('../../utils/family')

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
    location: '阳台',
    waterDays: 7,
    price: '',
    purchaseDate: '',
    purchaseSource: '',
    sourceOptions: ['花店', '网购', '花市', '亲友赠', '其他'],
    allRooms: ['阳台', '客厅', '卧室', '书房', '窗台', '花园'],
    // 自定义添加
    showCustomModal: false,
    customName: '',
    customEmoji: '🌱',
    customLocation: '阳台',
    customWaterDays: 7,
    customPrice: '',
    customPurchaseDate: '',
    customPurchaseSource: '',
    customFamily: '',
    customGenus: '',
    emojiOptions: ['🌱', '🌿', '🪴', '🌸', '🌺', '🌻', '🌹', '🌵', '🍀', '🪻', '🪷', '🌾', '🍃', '🌳', '🌴', '🫐', '🍅', '🌶️', '🧄', '💐']
  },

  onLoad() {
    this.setData({
      categories: plantsData.categories,
      filteredPlants: plantsData.plants
    })
    // 从识花页跳回来的
    const identified = wx.getStorageSync('identifiedPlant')
    if (identified) {
      wx.removeStorageSync('identifiedPlant')
      const match = plantsData.plants.find(p => p.name === identified.name)
      if (match) {
        this.setData({ selectedPlant: match, showModal: true, nickName: '', location: '阳台', waterDays: match.care.waterDays, price: '', purchaseDate: '', purchaseSource: '' })
      } else {
        // 识花结果不在数据库，走自定义（带AI识别的科属信息）
        this.setData({
          showCustomModal: true,
          customName: identified.name,
          customEmoji: '🌱',
          customFamily: identified.family || '',
          customGenus: identified.genus || '',
          customPrice: '',
          customPurchaseDate: '',
          customPurchaseSource: ''
        })
      }
    }
  },

  onShow() {
    let customRooms = []
    try { customRooms = wx.getStorageSync('customRooms') || [] } catch (e) {}
    const presetRooms = ['阳台', '客厅', '卧室', '书房', '窗台', '花园']
    this.setData({ allRooms: [...presetRooms, ...customRooms.filter(r => !presetRooms.includes(r))] })
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
        (p.family && p.family.includes(keyword)) ||
        p.category.includes(keyword)
      )
    }
    this.setData({ filteredPlants: list })
  },

  // 拍照识花 — 内联拍照，不走跳转
  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        this.doIdentify(tempPath)
      },
      fail: () => {
        // 用户取消或无权限
      }
    })
  },

  async doIdentify(imagePath) {
    wx.showLoading({ title: '识别中...' })
    try {
      const aiIdentify = require('../../utils/ai-identify')
      const result = await aiIdentify.identifyImage(imagePath)
      wx.hideLoading()

      if (result && result.plants && result.plants.length > 0) {
        // 识别成功，展示结果让用户选
        this.setData({ identifyResults: result.plants, showIdentifyModal: true })
      } else {
        wx.showToast({ title: '未能识别，请手动选择或自定义添加', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '识别失败，请手动选择', icon: 'none' })
    }
  },

  // 选择识别结果
  pickIdentifyResult(e) {
    const idx = e.currentTarget.dataset.index
    const result = this.data.identifyResults[idx]
    this.setData({ showIdentifyModal: false })

    const match = plantsData.plants.find(p => p.name === result.name || p.name.includes(result.name) || result.name.includes(p.name))
    if (match) {
      this.setData({ selectedPlant: match, showModal: true, nickName: '', location: '阳台', waterDays: match.care.waterDays, price: '', purchaseDate: '', purchaseSource: '' })
    } else {
      this.setData({
        showCustomModal: true,
        customName: result.name,
        customEmoji: result.emoji || '🌱',
        customPrice: '',
        customPurchaseDate: '',
        customPurchaseSource: ''
      })
    }
  },

  closeIdentifyModal() {
    this.setData({ showIdentifyModal: false })
  },

  // 打开自定义添加
  openCustomAdd() {
    this.setData({ showCustomModal: true, customName: this.data.keyword || '', customEmoji: '🌱', customLocation: '阳台', customWaterDays: 7, customPrice: '', customPurchaseDate: '', customPurchaseSource: '', customFamily: '', customGenus: '' })
  },

  selectCustomEmoji(e) {
    this.setData({ customEmoji: e.currentTarget.dataset.emoji })
  },

  onCustomNameInput(e) {
    this.setData({ customName: e.detail.value })
  },

  selectCustomLocation(e) {
    this.setData({ customLocation: e.currentTarget.dataset.value })
  },

  onCustomWaterDaysInput(e) {
    this.setData({ customWaterDays: Math.max(1, parseInt(e.detail.value) || 1) })
  },

  adjustCustomWaterDays(e) {
    const delta = parseInt(e.currentTarget.dataset.delta)
    this.setData({ customWaterDays: Math.max(1, this.data.customWaterDays + delta) })
  },

  onCustomPriceInput(e) {
    this.setData({ customPrice: e.detail.value })
  },

  onCustomPurchaseDateChange(e) {
    this.setData({ customPurchaseDate: e.detail.value })
  },

  selectCustomSource(e) {
    this.setData({ customPurchaseSource: e.currentTarget.dataset.value })
  },

  async confirmCustomAdd() {
    const nameCheck = validator.validateNickname(this.data.customName)
    if (!nameCheck.valid) {
      wx.showToast({ title: nameCheck.msg, icon: 'none' })
      return
    }
    const intervalCheck = validator.validateInterval(this.data.customWaterDays)
    if (!intervalCheck.valid) {
      wx.showToast({ title: intervalCheck.msg, icon: 'none' })
      return
    }

    const nickname = nameCheck.value
    const price = Math.max(0, parseFloat(this.data.customPrice) || 0)
    const purchaseDate = this.data.customPurchaseDate || ''
    const purchaseSource = this.data.customPurchaseSource || ''
    const plantFamily = this.data.customFamily || '自定义'
    const plantGenus = this.data.customGenus || ''

    // 家庭模式
    if (family.isInFamily()) {
      wx.showLoading({ title: '添加中...' })
      const result = await family.addPlant({
        plantId: 'custom_' + Date.now(),
        name: nickname,
        latin: '',
        family: plantFamily,
        genus: plantGenus,
        emoji: this.data.customEmoji,
        category: plantFamily === '自定义' ? '自定义' : plantFamily,
        nickname,
        location: this.data.customLocation,
        waterDays: this.data.customWaterDays,
        price,
        purchaseDate,
        purchaseSource
      })
      wx.hideLoading()
      if (result.success) {
        this.setData({ showCustomModal: false })
        wx.showToast({ title: '添加成功! 🎉', icon: 'none' })
        setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 800)
      } else {
        wx.showToast({ title: result.error || '添加失败', icon: 'none' })
      }
      return
    }

    // 个人模式
    const userPlant = {
      id: util.genId(),
      plantId: 'custom_' + Date.now(),
      name: nickname,
      latin: '',
      family: plantFamily,
      genus: plantGenus,
      emoji: this.data.customEmoji,
      category: plantFamily === '自定义' ? '自定义' : plantFamily,
      nickname,
      location: this.data.customLocation,
      addedAt: Date.now(),
      photo: null,
      purchasePrice: price,
      purchaseDate: purchaseDate || Date.now(),
      purchaseSource: purchaseSource
    }

    storage.addPlant(userPlant)

    const defaultTasks = [
      { type: 'water', typeName: '浇水', days: this.data.customWaterDays },
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

    this.setData({ showCustomModal: false })
    wx.showToast({ title: '添加成功! 🎉', icon: 'none' })

    const achievement = require('../../utils/achievement')
    achievement.checkAchievements()

    setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 800)
  },

  closeCustomModal() {
    this.setData({ showCustomModal: false })
  },

  selectPlant(e) {
    const plantId = e.currentTarget.dataset.id
    const plant = plantsData.plants.find(p => p.id === plantId)
    if (!plant) return
    this.setData({ selectedPlant: plant, showModal: true, nickName: '', location: '阳台', waterDays: plant.care.waterDays, price: '', purchaseDate: '', purchaseSource: '' })
  },

  onNickNameInput(e) {
    this.setData({ nickName: e.detail.value })
  },

  selectLocation(e) {
    this.setData({ location: e.currentTarget.dataset.value })
  },

  onWaterDaysInput(e) {
    const val = parseInt(e.detail.value) || 1
    this.setData({ waterDays: Math.max(1, val) })
  },

  adjustWaterDays(e) {
    const delta = parseInt(e.currentTarget.dataset.delta)
    const newVal = Math.max(1, this.data.waterDays + delta)
    this.setData({ waterDays: newVal })
  },

  onPriceInput(e) {
    this.setData({ price: e.detail.value })
  },

  onPurchaseDateChange(e) {
    this.setData({ purchaseDate: e.detail.value })
  },

  selectSource(e) {
    this.setData({ purchaseSource: e.currentTarget.dataset.value })
  },

  async confirmAdd() {
    const plant = this.data.selectedPlant
    if (!plant) return

    const nameCheck = validator.validateNickname(this.data.nickName || plant.name)
    if (!nameCheck.valid && this.data.nickName.trim()) {
      wx.showToast({ title: nameCheck.msg, icon: 'none' })
      return
    }
    const intervalCheck = validator.validateInterval(this.data.waterDays)
    if (!intervalCheck.valid) {
      wx.showToast({ title: intervalCheck.msg, icon: 'none' })
      return
    }

    const nickname = nameCheck.value || plant.name
    const location = this.data.location || '阳台'
    const price = Math.max(0, parseFloat(this.data.price) || 0)
    const purchaseDate = this.data.purchaseDate || ''
    const purchaseSource = this.data.purchaseSource || ''

    // 家庭模式
    if (family.isInFamily()) {
      wx.showLoading({ title: '添加中...' })
      const result = await family.addPlant({
        plantId: plant.id,
        name: plant.name,
        latin: plant.latin,
        family: plant.family || '',
        emoji: plant.emoji,
        category: plant.category,
        nickname,
        location,
        waterDays: this.data.waterDays,
        price,
        purchaseDate,
        purchaseSource
      })
      wx.hideLoading()
      if (result.success) {
        this.setData({ showModal: false })
        wx.showToast({ title: '添加成功! 🎉', icon: 'none' })
        setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 800)
      } else {
        wx.showToast({ title: result.error || '添加失败', icon: 'none' })
      }
      return
    }

    // 个人模式
    const userPlant = {
      id: util.genId(),
      plantId: plant.id,
      name: plant.name,
      latin: plant.latin,
      family: plant.family || '',
      emoji: plant.emoji,
      category: plant.category,
      nickname,
      location,
      addedAt: Date.now(),
      photo: null,
      purchasePrice: price,
      purchaseDate: purchaseDate || Date.now(),
      purchaseSource: purchaseSource
    }

    storage.addPlant(userPlant)

    const defaultTasks = [
      { type: 'water', typeName: '浇水', days: this.data.waterDays },
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

  preventBubble() {}
})
