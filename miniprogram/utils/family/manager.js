// utils/family/manager.js - 家庭模式管理器
// 负责判断家庭状态、缓存家庭数据、提供统一的数据读写接口

const CACHE_KEYS = {
  FAMILY_INFO: '_familyInfo',
  FAMILY_PLANTS: '_familyPlants',
  FAMILY_TASKS: '_familyTasks',
  FAMILY_RECORDS: '_familyRecords'
}

const FamilyManager = {
  /**
   * 是否处于家庭模式
   */
  isFamilyMode() {
    try {
      const info = wx.getStorageSync(CACHE_KEYS.FAMILY_INFO)
      return !!(info && info.inFamily)
    } catch (e) {
      return false
    }
  },

  /**
   * 获取缓存的家庭信息
   */
  getFamilyInfo() {
    try {
      return wx.getStorageSync(CACHE_KEYS.FAMILY_INFO) || { inFamily: false }
    } catch (e) {
      return { inFamily: false }
    }
  },

  /**
   * 保存家庭信息到缓存
   */
  saveFamilyInfo(info) {
    try {
      wx.setStorageSync(CACHE_KEYS.FAMILY_INFO, info)
    } catch (e) {}
  },

  /**
   * 清除家庭缓存
   */
  clearCache() {
    try {
      wx.removeStorageSync(CACHE_KEYS.FAMILY_INFO)
      wx.removeStorageSync(CACHE_KEYS.FAMILY_PLANTS)
      wx.removeStorageSync(CACHE_KEYS.FAMILY_TASKS)
      wx.removeStorageSync(CACHE_KEYS.FAMILY_RECORDS)
    } catch (e) {}
  },

  // ========== 查询家庭状态 ==========

  /**
   * 从云端检查并刷新家庭状态
   */
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

  // ========== 家庭植物 ==========

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

  // ========== 家庭任务 ==========

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

  // ========== 家庭记录 ==========

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

  // ========== 仪表盘（首页一次加载） ==========

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
