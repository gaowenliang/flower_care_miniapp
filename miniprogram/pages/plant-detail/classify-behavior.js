// pages/plant-detail/classify-behavior.js — 分类识别相关逻辑（Behavior）
const family = require('../../utils/family')
const storage = require('../../utils/storage')

module.exports = Behavior({
  data: {
    showClassifyAction: false,
    showClassifySearch: false,
    classifySearchKey: '',
    classifySearchResults: [],
    showClassifyResult: false,
    classifyResults: [],
    classifySelectedIdx: -1
  },

  methods: {
    showClassifyMenu() {
      this.setData({ showClassifyAction: true })
    },
    hideClassifyMenu() {
      this.setData({ showClassifyAction: false })
    },

    // 1. 填写分类 - 搜索科
    openClassifySearch() {
      this.setData({ showClassifyAction: false, showClassifySearch: true, classifySearchKey: '', classifySearchResults: [] })
    },
    hideClassifySearch() {
      this.setData({ showClassifySearch: false })
    },
    onClassifySearchInput(e) {
      const key = e.detail.value.trim()
      this.setData({ classifySearchKey: key })
      if (!key) { this.setData({ classifySearchResults: [] }); return }
      const allPlants = require('../../data/plants').plants

      // 搜索结果：同时匹配科名和种类名（植物名）
      // 格式: { label, family, priority }
      const speciesResults = []  // 种类匹配（优先）
      const familyResults = []   // 科名匹配
      const seenFamilies = new Set()

      allPlants.forEach(p => {
        const nameMatch = p.name && p.name.includes(key)
        const latinMatch = p.latin && p.latin.toLowerCase().includes(key.toLowerCase())
        const familyMatch = p.family && p.family.includes(key)

        // 种类匹配（植物名或拉丁名命中）→ 优先显示
        if ((nameMatch || latinMatch) && p.family) {
          speciesResults.push({ label: `${p.name} → ${p.family}`, family: p.family, priority: 0 })
        }

        // 科名匹配
        if (familyMatch && !seenFamilies.has(p.family)) {
          seenFamilies.add(p.family)
          familyResults.push({ label: p.family, family: p.family, priority: 1 })
        }
      })

      // 手动输入也加入（如用户输入"百合科"）
      if (key.endsWith('科') && !seenFamilies.has(key)) {
        familyResults.push({ label: key, family: key, priority: 1 })
      }

      // 种类优先，然后科名
      const merged = [...speciesResults, ...familyResults].slice(0, 10)
      this.setData({ classifySearchResults: merged })
    },
    selectFamily(e) {
      const item = e.currentTarget.dataset.family
      const familyName = typeof item === 'string' ? item : item.family
      this._updatePlantClassify({ family: familyName })
      this.setData({ showClassifySearch: false })
    },
    confirmClassifyInput() {
      const key = this.data.classifySearchKey
      if (!key) return
      this._updatePlantClassify({ family: key })
      this.setData({ showClassifySearch: false })
    },

    // 2. AI识别 - 头像
    async identifyAvatar() {
      this.setData({ showClassifyAction: false })
      if (!this.data.userPlant.avatar) {
        wx.showToast({ title: '暂无头像', icon: 'none' }); return
      }
      wx.showLoading({ title: 'AI识别中...' })
      try {
        const aiIdentify = require('../../utils/ai-identify')
        const result = await aiIdentify.identifyFromUrl(this.data.userPlant.avatar)
        if (result.plants && result.plants.length > 0) {
          this.setData({ showClassifyResult: true, classifyResults: result.plants.slice(0, 5), classifySelectedIdx: -1 })
        } else {
          wx.showToast({ title: result.error || '识别失败', icon: 'none' })
        }
      } catch (e) {
        wx.showToast({ title: '识别失败', icon: 'none' })
      }
      wx.hideLoading()
    },

    // 3. AI识别 - 拍照/相册
    async identifyPhoto() {
      this.setData({ showClassifyAction: false })
      wx.chooseMedia({
        count: 1, mediaType: ['image'], sizeType: ['compressed'],
        success: async (res) => {
          const tempPath = res.tempFiles[0].tempFilePath
          wx.showLoading({ title: 'AI识别中...' })
          try {
            const aiIdentify = require('../../utils/ai-identify')
            const result = await aiIdentify.identifyImage(tempPath)
            if (result.plants && result.plants.length > 0) {
              this.setData({ showClassifyResult: true, classifyResults: result.plants.slice(0, 5), classifySelectedIdx: -1 })
            } else {
              wx.showToast({ title: result.error || '识别失败', icon: 'none' })
            }
          } catch (e) {
            wx.showToast({ title: '识别失败', icon: 'none' })
          }
          wx.hideLoading()
        }
      })
    },

    // 点击候选直接应用
    selectClassifyItem(e) {
      const idx = parseInt(e.currentTarget.dataset.idx)
      const r = this.data.classifyResults[idx]
      if (!r) return
      const updates = {}
      if (r.family) updates.family = r.family
      if (r.genus) updates.genus = r.genus
      if (r.name) updates.latin = r.name
      this.setData({ showClassifyResult: false, classifySelectedIdx: -1 })
      this._updatePlantClassify(updates)
    },

    applyClassifyResult() {
      const idx = this.data.classifySelectedIdx
      if (idx < 0 || idx === undefined || idx === null) {
        wx.showToast({ title: '请先选择一个结果', icon: 'none' }); return
      }
      const r = this.data.classifyResults[idx]
      if (!r) { wx.showToast({ title: '请先选择一个结果', icon: 'none' }); return }
      const updates = {}
      if (r.family) updates.family = r.family
      if (r.genus) updates.genus = r.genus
      if (r.name) updates.latin = r.name
      this.setData({ showClassifyResult: false, classifySelectedIdx: -1 })
      this._updatePlantClassify(updates)
    },

    hideClassifyResult() {
      this.setData({ showClassifyResult: false })
    },

    // 内部：更新植物分类信息
    async _updatePlantClassify(updates) {
      const up = { ...this.data.userPlant, ...updates }
      const pi = { ...this.data.plantInfo }
      if (updates.family) pi.category = updates.family
      if (updates.genus) pi.genus = updates.genus
      if (updates.latin) pi.latin = updates.latin
      this.setData({ userPlant: up, plantInfo: pi })

      const plantId = this.data.userPlant._id || this.data.userPlant.id
      if (this.data.isFamilyMode && plantId) {
        try {
          await family.updatePlant(plantId, updates)
          await family.getPlants(true)
        } catch (e) {
          wx.showToast({ title: '保存失败', icon: 'none' }); return
        }
      } else if (!this.data.isFamilyMode) {
        storage.updatePlant(this.data.userPlant.id, updates)
      }
      wx.showToast({ title: '已更新', icon: 'none' })
    }
  }
})
