// utils/family/manager.js - 家庭模式管理器
// 负责判断家庭状态、缓存家庭数据、提供统一的数据读写接口

const CACHE_KEYS = {
  FAMILY_INFO: '_familyInfo',
  FAMILY_PLANTS: '_familyPlants',
  FAMILY_TASKS: '_familyTasks',
  FAMILY_RECORDS: '_familyRecords'
}

const FamilyManager = {
  // ========== 基础状态 ==========

  isFamilyMode() {
    try {
      const info = wx.getStorageSync(CACHE_KEYS.FAMILY_INFO)
      return !!(info && info.inFamily)
    } catch (e) {
      return false
    }
  },

  isInFamily() {
    return this.isFamilyMode()
  },

  getFamilyInfo() {
    try {
      return wx.getStorageSync(CACHE_KEYS.FAMILY_INFO) || { inFamily: false }
    } catch (e) {
      return { inFamily: false }
    }
  },

  saveFamilyInfo(info) {
    try {
      wx.setStorageSync(CACHE_KEYS.FAMILY_INFO, info)
    } catch (e) {}
  },

  clearCache() {
    try {
      wx.removeStorageSync(CACHE_KEYS.FAMILY_INFO)
      wx.removeStorageSync(CACHE_KEYS.FAMILY_PLANTS)
      wx.removeStorageSync(CACHE_KEYS.FAMILY_TASKS)
      wx.removeStorageSync(CACHE_KEYS.FAMILY_RECORDS)
    } catch (e) {}
  },

  // ========== 家庭状态刷新 ==========

  async refreshFamilyStatus() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyManage',
        data: { action: 'getMyFamily' }
      })
      const result = res.result
      if (result.success) {
        this.saveFamilyInfo(result)
        if (!result.inFamily) {
          this.clearCache()
        }
      }
      return result
    } catch (e) {
      return this.getFamilyInfo()
    }
  },

  // ========== 植物 ==========

  getFamilyPlants() {
    try {
      return wx.getStorageSync(CACHE_KEYS.FAMILY_PLANTS) || []
    } catch (e) {
      return []
    }
  },

  saveFamilyPlants(plants) {
    try {
      wx.setStorageSync(CACHE_KEYS.FAMILY_PLANTS, plants)
    } catch (e) {}
  },

  getCachedPlants() {
    return this.getFamilyPlants()
  },

  getPlantById(id) {
    const plants = this.getFamilyPlants()
    return plants.find(p => p._id === id || p.id === id)
  },

  async loadFamilyPlants() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyData',
        data: { action: 'getPlants' }
      })
      if (res.result.success) {
        this.saveFamilyPlants(res.result.plants)
        return res.result.plants
      }
    } catch (e) {}
    return this.getFamilyPlants()
  },

  async getPlants(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = this.getFamilyPlants()
      if (cached.length > 0) return cached
    }
    return await this.loadFamilyPlants()
  },

  async addPlant(plantData) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyData',
        data: { action: 'addPlant', plant: plantData }
      })
      if (res.result.success) {
        await this.loadFamilyPlants()
      }
      return res.result
    } catch (e) {
      return { success: false, error: '添加失败' }
    }
  },

  async removePlant(plantId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyData',
        data: { action: 'deletePlant', plantId }
      })
      if (res.result.success) {
        await this.loadFamilyPlants()
      }
      return res.result
    } catch (e) {
      return { success: false, error: '删除失败' }
    }
  },

  // ========== 任务 ==========

  getFamilyTasks() {
    try {
      return wx.getStorageSync(CACHE_KEYS.FAMILY_TASKS) || []
    } catch (e) {
      return []
    }
  },

  saveFamilyTasks(tasks) {
    try {
      wx.setStorageSync(CACHE_KEYS.FAMILY_TASKS, tasks)
    } catch (e) {}
  },

  getCachedTasks() {
    return this.getFamilyTasks()
  },

  async loadFamilyTasks(plantId) {
    try {
      const data = { action: 'getTasks' }
      if (plantId) data.plantId = plantId
      const res = await wx.cloud.callFunction({ name: 'familyData', data })
      if (res.result.success) {
        if (!plantId) this.saveFamilyTasks(res.result.tasks)
        return res.result.tasks
      }
    } catch (e) {}
    return this.getFamilyTasks()
  },

  async getTasks(plantId = '', forceRefresh = false) {
    if (!forceRefresh && !plantId) {
      const cached = this.getFamilyTasks()
      if (cached.length > 0) return cached
    }
    return await this.loadFamilyTasks(plantId)
  },

  async completeTask(taskId) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyData',
        data: { action: 'completeTask', taskId }
      })
      if (res.result.success) {
        await this.loadFamilyTasks()
      }
      return res.result
    } catch (e) {
      return { success: false, error: '完成失败' }
    }
  },

  // ========== 记录 ==========

  getFamilyRecords() {
    try {
      return wx.getStorageSync(CACHE_KEYS.FAMILY_RECORDS) || []
    } catch (e) {
      return []
    }
  },

  saveFamilyRecords(records) {
    try {
      wx.setStorageSync(CACHE_KEYS.FAMILY_RECORDS, records)
    } catch (e) {}
  },

  async loadFamilyRecords(plantId, limit) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyData',
        data: { action: 'getRecords', plantId, limit: limit || 200 }
      })
      if (res.result.success) {
        if (!plantId) this.saveFamilyRecords(res.result.records)
        return res.result.records
      }
    } catch (e) {}
    return this.getFamilyRecords()
  },

  async getRecords(plantId = '', limit = 100) {
    return await this.loadFamilyRecords(plantId, limit)
  },

  async addRecord(recordData) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyData',
        data: { action: 'addRecord', record: recordData }
      })
      return res.result
    } catch (e) {
      return { success: false, error: '添加失败' }
    }
  },

  async deleteRecord(recordId) {
    return { success: false, error: '家庭模式下暂不支持删除记录' }
  },

  // ========== 仪表盘 ==========

  async loadDashboard() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'familyData',
        data: { action: 'getDashboard' }
      })
      if (res.result.success) {
        this.saveFamilyPlants(res.result.plants)
        this.saveFamilyTasks(res.result.tasks)
        return res.result
      }
    } catch (e) {}
    return null
  }
}

module.exports = FamilyManager
